"""Anthropic Claude API クライアント - Claude Sonnet 4.5 統一使用"""
import httpx
from typing import List, Dict
from app.utils.logger import logger

# 統一モデル: Claude Sonnet 4.5 (最新版 - 2025年9月リリース)
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
MODEL_DISPLAY_NAME = "Claude Sonnet 4.5"

# 利用可能なモデル（UI非表示だが内部で使用）
AVAILABLE_MODELS = [
    {
        "id": "claude-sonnet-4-5-20250929",
        "name": "Claude Sonnet 4.5",
        "description": "世界最高レベルのコーディングモデル（2025年9月版）"
    },
    {
        "id": "claude-opus-4-5-20251101",
        "name": "Claude Opus 4.5",
        "description": "最も高度な推論能力（高コスト）"
    },
    {
        "id": "claude-haiku-4-5-20251001",
        "name": "Claude Haiku 4.5",
        "description": "高速・軽量モデル"
    },
]


async def call_anthropic_api(
    api_key: str,
    messages: List[Dict],
    model: str = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    timeout: int = 180,
    system_prompt: str = None
) -> str:
    """
    Anthropic Claude APIを呼び出す
    
    Args:
        api_key: Anthropic APIキー
        messages: Chat形式のメッセージリスト [{"role": "user", "content": "..."}]
        model: 使用するモデル（デフォルト: claude-sonnet-4-20250514）
        max_tokens: 最大トークン数
        temperature: 温度パラメータ
        timeout: タイムアウト秒数
        system_prompt: システムプロンプト（オプション）
    
    Returns:
        AIの応答テキスト
    """
    if model is None:
        model = DEFAULT_MODEL
    
    # タイムアウト設定
    timeout_config = httpx.Timeout(timeout, connect=10.0)
    
    # メッセージをAnthropic形式に変換
    anthropic_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        
        # Anthropicはsystemロールをmessagesに含めない
        if role == "system":
            if not system_prompt:
                system_prompt = content
            continue
        
        # assistant/userのみ許可
        if role not in ["user", "assistant"]:
            role = "user"
        
        anthropic_messages.append({
            "role": role,
            "content": content
        })
    
    # メッセージが空の場合
    if not anthropic_messages:
        anthropic_messages = [{"role": "user", "content": "Hello"}]
    
    # リクエストボディ
    request_body = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": anthropic_messages,
    }
    
    # システムプロンプトがあれば追加
    if system_prompt:
        request_body["system"] = system_prompt
    
    # temperatureは0-1の範囲
    if temperature is not None:
        request_body["temperature"] = min(max(temperature, 0), 1)
    
    logger.info(f"Calling Anthropic API with model: {model}")
    
    async with httpx.AsyncClient(timeout=timeout_config) as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json=request_body
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"Anthropic API Error: {response.status_code} - {error_detail}")
                
                # よくあるエラーの対処法を追加
                if response.status_code == 401:
                    raise Exception("APIキーが無効です。Anthropic APIキーを確認してください。")
                elif response.status_code == 429:
                    raise Exception("APIレート制限に達しました。しばらく待ってから再試行してください。")
                elif response.status_code == 500:
                    raise Exception("Anthropicサーバーエラー。しばらく待ってから再試行してください。")
                else:
                    raise Exception(f"API Error: {response.status_code} - {error_detail}")
            
            result = response.json()
            
            # レスポンスからテキストを抽出
            content = result.get("content", [])
            if content and isinstance(content, list):
                for block in content:
                    if block.get("type") == "text":
                        return block.get("text", "")
            
            logger.warning(f"Unexpected response format: {result}")
            return str(result)
            
        except httpx.ConnectError as e:
            logger.error(f"Anthropic API connection error: {e}")
            raise Exception(f"接続エラー: Anthropic APIに接続できません。ネットワークを確認してください。")
        except httpx.ReadTimeout as e:
            logger.error(f"Anthropic API timeout: {e}")
            raise Exception(f"タイムアウト: 応答に時間がかかりすぎています。")


def get_available_models() -> List[Dict]:
    """利用可能なモデルリストを返す"""
    return AVAILABLE_MODELS


def get_default_model() -> str:
    """デフォルトモデルを返す"""
    return DEFAULT_MODEL


def get_model_display_name() -> str:
    """モデル表示名を返す"""
    return MODEL_DISPLAY_NAME
