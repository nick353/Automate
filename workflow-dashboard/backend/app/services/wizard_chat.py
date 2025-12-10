"""ウィザードチャットサービス（AIヒアリング）"""
import json
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import WizardSession
from app.services.credential_manager import credential_manager
from app.services.openai_client import call_openai_api, DEFAULT_CHAT_MODEL, get_available_models
from app.utils.logger import logger


class WizardChatService:
    """AIによるヒアリングチャット"""
    
    async def chat(
        self,
        db: Session,
        session: WizardSession,
        user_message: str,
        model: str = None
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
            
            system_prompt = f"""あなたはユーザーの自動化フローを一緒に作るAIアシスタントです。初心者にも伝わるように、短くやさしい言葉で説明してください。専門用語はできるだけ避け、出す場合はかんたんな言い換えも添えてください。最初に「ユーザーが用意するとスムーズなもの（目的、サイトURL、実行頻度、必要なログイン情報やAPIキー）」をやさしく案内し、以降のやり取りでも必要な情報を一つずつ確認してください。

{video_context}

【重要な行動指針】

1. まずしっかりヒアリングする
   - ユーザーが何を自動化したいのか詳しく聞く
   - 現在どのように作業しているか確認
   - 使用するサービス、頻度、出力先などを把握
   - 不明な点は必ず質問する

2. 全体像を説明する
   - ヒアリング後、作成するタスクの全体像を説明
   - 「合計○個のタスクを作成します」と数を伝える
   - 各タスクの役割と連携を説明

3. 最終確認を取る
   - 全体像を説明した後「この内容で作成してよろしいですか？」と確認
   - ユーザーが「作成してください」「お願いします」などと言ったら作成開始
   - 勝手に作成しない

4. 一つずつ作成する
   - タスクは一つずつ作成
   - 作成後「タスク○を作成しました。次のタスク○に進みますか？」と確認
   - ユーザーの確認を得てから次へ

5. API優先で考える
   - Google系、Slack、Discord、Twitter、Notionなどは公式APIを推奨
   - APIがない場合のみブラウザ自動化を提案

【タスク作成時のJSON形式】
作成する際は以下の形式で出力：
```json
{{
    "actions": [
        {{
            "type": "create_task",
            "data": {{
                "name": "タスク名",
                "description": "説明",
                "task_prompt": "AIエージェントへの詳細な指示",
                "role_group": "役割グループ名",
                "schedule": "cron形式",
                "execution_location": "server または local"
            }}
        }}
    ],
    "creating_info": {{
        "current": 1,
        "total": 3,
        "task_name": "作成中のタスク名"
    }}
}}
```

【重要: 出力フォーマット（必ず守ること）】

★★★ 絶対ルール ★★★
1. 番号リスト「1) 2) 3)」や「1. 2. 3.」は絶対に使わない
2. 各セクションは絵文字見出しで始める（📌 📂 💬 🔑 🖥️ 📊 ✅ ❓）
3. セクション間は必ず空行を2行入れる
4. 箇条書きの各項目も1行ずつ空ける
5. #や---、**太字**は使わない

★★★ 正しい出力形式 ★★★

📌 確認事項

最初に自動化したい内容を教えてください。


📂 対象サービス

どのサービスを自動化しますか？


💬 実行タイミング

いつ実行しますか？（毎日、毎週など）


★★★ 禁止例（こう書いてはいけない）★★★
× 1) 〜について
× 2) 〜を確認
× 1. まず〜
× - 項目1 - 項目2（空行なしで連続）

上記ルールに従い、日本語でやさしく回答してください。"""

            # システムメッセージを含むメッセージリストを作成
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend([{"role": msg["role"], "content": msg["content"]} for msg in chat_history])
            
            # 統一されたOpenAI APIクライアントを使用
            use_model = model or DEFAULT_CHAT_MODEL
            assistant_message = await call_openai_api(
                api_key=api_key,
                messages=messages,
                model=use_model,
                max_tokens=2048,
                timeout=120
            )
            
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
        session: WizardSession,
        model: str = None
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
            
            # 統一されたOpenAI APIクライアントを使用
            use_model = model or DEFAULT_CHAT_MODEL
            response_text = await call_openai_api(
                api_key=api_key,
                messages=[{"role": "user", "content": prompt}],
                model=use_model,
                max_tokens=2048,
                timeout=120
            )
            
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

