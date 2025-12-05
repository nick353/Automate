"""ウィザードチャットサービス（AIヒアリング）"""
import json
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import WizardSession
from app.services.credential_manager import credential_manager
from app.utils.logger import logger


class WizardChatService:
    """AIによるヒアリングチャット"""
    
    async def chat(
        self,
        db: Session,
        session: WizardSession,
        user_message: str
    ) -> dict:
        """ユーザーメッセージに応答"""
        try:
            # チャット履歴を取得
            chat_history = json.loads(session.chat_history or "[]")
            
            # ユーザーメッセージを追加
            chat_history.append({
                "role": "user",
                "content": user_message
            })
            
            # Anthropic APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "anthropic")
            if not cred:
                raise ValueError("Anthropic APIキーが設定されていません")
            
            api_key = cred["data"].get("api_key")
            
            # Anthropic APIを呼び出し
            import httpx
            
            # 動画分析結果をコンテキストに含める
            video_analysis = json.loads(session.video_analysis or "{}")
            
            system_prompt = f"""あなたはブラウザ自動化タスクの作成を支援するAIアシスタントです。

ユーザーがアップロードした動画の分析結果:
{json.dumps(video_analysis, ensure_ascii=False, indent=2)}

## あなたの役割（重要度順）:

### 1. API優先アプローチ（最重要）
**ブラウザ操作を提案する前に、必ず以下を確認してください：**
- 対象サイト/サービスが公式APIを提供しているかリサーチ
- APIがある場合は、ブラウザ操作よりAPIを使用することを強く推奨
- 例: 「このサービスはAPIを提供しています。APIキーを取得すればブラウザ操作より簡単かつ安定して実行できます。APIキーはお持ちですか？」

**よくあるサービスのAPI情報:**
- Google系（Gmail, Sheets, Drive等）→ Google Cloud APIs
- Slack → Slack API
- Twitter/X → X API
- Notion → Notion API
- GitHub → GitHub API
- Shopify → Shopify API
- Salesforce → Salesforce API
- 楽天 → 楽天API
- Amazon → Amazon SP-API

### 2. ヒアリング
- 動画の内容について不明点があれば質問
- タスクの詳細（頻度、入力データ、例外処理など）を確認
- APIを使う場合はAPIキーの有無を確認

### 3. 確認と提案
- API利用可能な場合：APIベースの実装を提案し、必要なAPIキーを案内
- API不可の場合：ブラウザ自動化での実装を提案
- 十分な情報が集まったら、タスクの内容を要約

### 4. 完了
- 確認が取れたら「タスクを作成する準備ができました」と伝える

回答は日本語で、簡潔かつ親切に行ってください。
API優先のアプローチを忘れずに！"""

            messages = [{"role": msg["role"], "content": msg["content"]} for msg in chat_history]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 1024,
                        "system": system_prompt,
                        "messages": messages
                    },
                    timeout=60
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code} - {response.text}")
                
                result = response.json()
                assistant_message = result["content"][0]["text"]
            
            # アシスタントメッセージを追加
            chat_history.append({
                "role": "assistant",
                "content": assistant_message
            })
            
            # セッションを更新
            session.chat_history = json.dumps(chat_history, ensure_ascii=False)
            db.commit()
            
            # タスク作成の準備ができたかチェック
            is_ready = "タスクを作成する準備ができました" in assistant_message or "準備ができました" in assistant_message
            
            return {
                "response": assistant_message,
                "is_ready_to_create": is_ready,
                "chat_history": chat_history
            }
            
        except Exception as e:
            logger.error(f"チャットエラー: {e}")
            return {
                "response": f"エラーが発生しました: {str(e)}",
                "is_ready_to_create": False,
                "error": str(e)
            }
    
    async def generate_task(
        self,
        db: Session,
        session: WizardSession
    ) -> dict:
        """チャット履歴からタスクを生成"""
        try:
            # Anthropic APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "anthropic")
            if not cred:
                raise ValueError("Anthropic APIキーが設定されていません")
            
            api_key = cred["data"].get("api_key")
            
            chat_history = json.loads(session.chat_history or "[]")
            video_analysis = json.loads(session.video_analysis or "{}")
            
            prompt = f"""以下の動画分析結果とユーザーとの会話に基づいて、自動化タスクを生成してください。

動画分析結果:
{json.dumps(video_analysis, ensure_ascii=False, indent=2)}

会話履歴:
{json.dumps(chat_history, ensure_ascii=False, indent=2)}

## タスク生成のルール

### API利用の場合（会話でAPIの使用が合意された場合）
- task_typeを"api"に設定
- task_promptにAPIの呼び出し手順を記載
- 必要なAPIキーの種類を明記
- ブラウザ操作は含めない

### ブラウザ自動化の場合（APIが使えない場合）
- task_typeを"browser"に設定
- task_promptにブラウザ操作の手順を記載
- サイトへのアクセス、ログイン、目的の操作、結果確認まで含める

以下のJSON形式で回答してください（JSONのみ、説明不要）：
```json
{{
    "task_name": "タスク名（簡潔に）",
    "task_description": "タスクの説明（1-2文）",
    "task_type": "api または browser",
    "task_prompt": "詳細な指示。APIの場合はAPI呼び出し手順、ブラウザの場合は操作手順を記載。",
    "required_credentials": ["必要な認証情報のリスト（例: anthropic_api_key, google_sheets_api_key等）"],
    "schedule": "推奨スケジュール（cron形式: 例 '0 9 * * *' = 毎日9時、または空文字）"
}}
```"""
            
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 2048,
                        "messages": [{"role": "user", "content": prompt}]
                    },
                    timeout=60
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code}")
                
                result = response.json()
                response_text = result["content"][0]["text"]
            
            # JSONを抽出
            json_start = response_text.find("```json")
            json_end = response_text.find("```", json_start + 7)
            
            if json_start != -1 and json_end != -1:
                json_str = response_text[json_start + 7:json_end].strip()
                task_data = json.loads(json_str)
            else:
                # フォールバック: 全体をJSONとしてパース試行
                task_data = json.loads(response_text)
            
            # セッションを更新
            session.generated_task = json.dumps(task_data, ensure_ascii=False)
            session.status = "completed"
            db.commit()
            
            return {
                "success": True,
                "task": task_data
            }
            
        except Exception as e:
            logger.error(f"タスク生成エラー: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# シングルトンインスタンス
wizard_chat_service = WizardChatService()

