"""OpenAI API クライアント（Chat Completions API と Responses API 両対応）"""
import httpx
from typing import List, Dict, Optional
from app.utils.logger import logger

# 利用可能なモデルリスト
AVAILABLE_MODELS = [
    {"id": "gpt-5.1-codex-max", "name": "GPT-5.1 Codex Max", "api": "responses", "description": "最高性能のコーディングモデル（推奨）"},
    {"id": "gpt-5.1-codex", "name": "GPT-5.1 Codex", "api": "responses", "description": "高性能コーディングモデル"},
    {"id": "gpt-5.1-codex-mini", "name": "GPT-5.1 Codex Mini", "api": "responses", "description": "軽量コーディングモデル"},
    {"id": "gpt-5.1", "name": "GPT-5.1", "api": "responses", "description": "最新の推論モデル"},
    {"id": "gpt-4.1", "name": "GPT-4.1", "api": "chat", "description": "安定した汎用モデル"},
    {"id": "gpt-4o", "name": "GPT-4o", "api": "chat", "description": "マルチモーダル対応モデル"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "api": "chat", "description": "軽量・高速モデル"},
]

# デフォルトモデル（Codex Max）
DEFAULT_CHAT_MODEL = "gpt-5.1-codex-max"

# Responses APIを使用するモデル
RESPONSES_API_MODELS = [
    "gpt-5.1-codex-max",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.1",
    "gpt-5.1-chat-latest",
]


def is_responses_api_model(model: str) -> bool:
    """Responses APIを使用するモデルかどうかを判定"""
    return model in RESPONSES_API_MODELS or model.startswith("gpt-5")


def _extract_output_text(result: Dict) -> str:
    """Responses APIレスポンスからテキストを抽出"""
    output_text = result.get("output_text", "")
    if output_text:
        return output_text
    
    outputs = result.get("output", [])
    if outputs and isinstance(outputs, list):
        for output in outputs:
            if output.get("type") == "message":
                content = output.get("content", [])
                for c in content:
                    if c.get("type") == "output_text":
                        return c.get("text", "")
    return ""


def convert_messages_to_input(messages: List[Dict]) -> str:
    """Chat形式のメッセージをResponses API用のinputテキストに変換"""
    parts = []
    for msg in messages:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        parts.append(f"[{role}]\n{content}")
    return "\n\n".join(parts)


async def call_openai_api(
    api_key: str,
    messages: List[Dict],
    model: str = None,
    max_tokens: int = 1024,
    temperature: float = 0.7,
    timeout: int = 120
) -> str:
    """
    モデルに応じて適切なOpenAI APIを呼び出す
    
    Args:
        api_key: OpenAI APIキー
        messages: Chat Completions形式のメッセージリスト
        model: 使用するモデル（デフォルト: gpt-5.1-codex-max）
        max_tokens: 最大トークン数
        temperature: 温度パラメータ
        timeout: タイムアウト秒数
    
    Returns:
        AIの応答テキスト
    """
    if model is None:
        model = DEFAULT_CHAT_MODEL
    
    async with httpx.AsyncClient() as client:
        if is_responses_api_model(model):
            # Responses API を使用
            return await _call_responses_api(
                client, api_key, messages, model, max_tokens, temperature, timeout
            )
        else:
            # Chat Completions API を使用
            return await _call_chat_completions_api(
                client, api_key, messages, model, max_tokens, temperature, timeout
            )


async def _call_responses_api(
    client: httpx.AsyncClient,
    api_key: str,
    messages: List[Dict],
    model: str,
    max_tokens: int,
    temperature: float,
    timeout: int
) -> str:
    """Responses API を呼び出す"""
    input_text = convert_messages_to_input(messages)
    logger.info(f"Calling Responses API with model: {model}")

    current_max_tokens = max_tokens
    # 1回目でトークン上限に達した場合のみ、上限を増やして再試行する
    for attempt in range(2):
        request_body = {
            "model": model,
            "input": input_text,
            "max_output_tokens": current_max_tokens,
        }
        # codex系モデル以外の場合のみtemperatureを追加
        if "codex" not in model.lower():
            request_body["temperature"] = temperature
        
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=request_body,
            timeout=timeout
        )
        
        if response.status_code != 200:
            error_detail = response.text
            logger.error(f"Responses API Error: {response.status_code} - {error_detail}")
            raise Exception(f"API Error: {response.status_code} - {error_detail}")
        
        result = response.json()
        output_text = _extract_output_text(result)
        status = result.get("status")
        incomplete_reason = (result.get("incomplete_details") or {}).get("reason")
        
        if output_text:
            return output_text
        
        # 出力がトークン上限により途切れた場合は、1度だけ上限を増やして再試行
        if (
            attempt == 0
            and status == "incomplete"
            and incomplete_reason == "max_output_tokens"
        ):
            logger.info(
                f"Responses API output was truncated (max_output_tokens={current_max_tokens}). Retrying with a higher limit."
            )
            current_max_tokens = min(current_max_tokens * 2, 8192)
            continue
        
        logger.warning(f"No output_text in response: {result}")
        return str(result)
    
    return ""


async def _call_chat_completions_api(
    client: httpx.AsyncClient,
    api_key: str,
    messages: List[Dict],
    model: str,
    max_tokens: int,
    temperature: float,
    timeout: int
) -> str:
    """Chat Completions API を呼び出す"""
    logger.info(f"Calling Chat Completions API with model: {model}")
    
    response = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages
        },
        timeout=timeout
    )
    
    if response.status_code != 200:
        error_detail = response.text
        logger.error(f"Chat Completions API Error: {response.status_code} - {error_detail}")
        raise Exception(f"API Error: {response.status_code} - {error_detail}")
    
    result = response.json()
    return result["choices"][0]["message"]["content"]


def get_available_models() -> List[Dict]:
    """利用可能なモデルリストを返す"""
    return AVAILABLE_MODELS

