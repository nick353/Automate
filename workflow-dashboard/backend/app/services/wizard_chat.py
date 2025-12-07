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
            
            # OpenAI APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                raise ValueError("OpenAI APIキーが設定されていません")
            
            api_key = cred["data"].get("api_key")
            
            # OpenAI APIを呼び出し
            import httpx
            
            # 動画分析結果をコンテキストに含める（あれば）
            video_analysis = json.loads(session.video_analysis or "{}")
            has_video = bool(video_analysis)
            
            video_context = ""
            if has_video:
                video_context = f"""
## ユーザーがアップロードした動画の分析結果:
{json.dumps(video_analysis, ensure_ascii=False, indent=2)}

この動画分析に基づいて、不明点があれば質問してください。
"""
            
            system_prompt = f"""あなたは自動化タスクの作成を支援するフレンドリーなAIアシスタントです。

{video_context}

## あなたの役割（重要度順）:

### 1. ヒアリングと理解
- ユーザーが何を自動化したいのかをしっかり理解する
- 不明点があれば具体的に質問する
- 例：「どのサイトで行いますか？」「どのくらいの頻度で実行しますか？」「結果はどこに保存しますか？」

### 2. API優先アプローチ（非常に重要）
**ブラウザ操作を提案する前に、必ず以下を確認してください：**

✅ **APIが使えるケース（推奨）:**
- Google系（Gmail, Sheets, Drive, Calendar）→ Google Cloud APIs
- Slack / Discord → 公式API
- Twitter/X → X API
- Notion → Notion API
- GitHub → GitHub API
- Shopify / EC系 → 各種API
- OpenAI / Anthropic → 直接API

💡 **APIが使える場合のメッセージ例:**
「このサービスは**公式API**を提供しています！
APIを使えばブラウザ操作より**安定・高速・確実**に実行できます。
APIキーはお持ちですか？なければ取得方法をお伝えします。」

❌ **ブラウザ操作が必要なケース:**
- APIがないサイト
- APIで対応できない操作（スクリーンショット取得など）
- ログイン必須でAPIがない場合

### 3. 実行方法の提案
- **ヘッドレスブラウザ（サーバー実行）**: 定期実行、24時間稼働向け
- **デスクトップ操作（ローカルPC）**: Excel操作、ローカルアプリ向け
- **API呼び出し**: 最も安定・推奨

### 4. タスク作成の準備
十分な情報が集まったら:
1. タスクの概要を要約
2. 「**タスクを作成する準備ができました**」と明確に伝える

## レスポンスのスタイル
- 絵文字を適度に使い、親しみやすく
- 箇条書きで分かりやすく
- 技術用語は必要に応じて説明を添える
- 日本語で回答"""

            # システムメッセージを含むメッセージリストを作成
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend([{"role": msg["role"], "content": msg["content"]} for msg in chat_history])
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-5.1",
                        "max_tokens": 1024,
                        "messages": messages
                    },
                    timeout=60
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code} - {response.text}")
                
                result = response.json()
                assistant_message = result["choices"][0]["message"]["content"]
            
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
            # OpenAI APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                raise ValueError("OpenAI APIキーが設定されていません")
            
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
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-5.1",
                        "max_tokens": 2048,
                        "messages": [{"role": "user", "content": prompt}]
                    },
                    timeout=60
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code}")
                
                result = response.json()
                response_text = result["choices"][0]["message"]["content"]
            
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

