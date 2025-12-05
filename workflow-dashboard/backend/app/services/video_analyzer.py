"""動画分析サービス（Gemini 1.5 Pro）"""
import os
import json
from pathlib import Path
from typing import Optional
import google.generativeai as genai
from sqlalchemy.orm import Session

from app.services.credential_manager import credential_manager
from app.utils.logger import logger


class VideoAnalyzer:
    """Gemini 1.5 Proを使った動画分析"""
    
    def __init__(self):
        self._model = None
    
    def _get_model(self, db: Session):
        """Geminiモデルを取得"""
        # Google APIキーを取得
        cred = credential_manager.get_default(db, "api_key", "google")
        if not cred:
            raise ValueError("Google APIキーが設定されていません")
        
        api_key = cred["data"].get("api_key")
        if not api_key:
            raise ValueError("Google APIキーが見つかりません")
        
        genai.configure(api_key=api_key)
        return genai.GenerativeModel("gemini-1.5-pro")
    
    async def analyze_video(
        self,
        db: Session,
        video_path: str,
        additional_context: str = ""
    ) -> dict:
        """動画を分析してタスクの候補を生成"""
        try:
            model = self._get_model(db)
            
            # 動画ファイルをアップロード
            video_file = genai.upload_file(path=video_path)
            
            # 分析プロンプト
            prompt = f"""この動画はブラウザ操作の録画です。以下の点を分析してください：

1. **操作の目的**: この動画で何を達成しようとしていますか？
2. **主要なステップ**: 具体的にどのような操作が行われていますか？（クリック、入力、スクロールなど）
3. **対象サイト/アプリ**: どのウェブサイトやアプリケーションが使われていますか？
4. **入力されたデータ**: フォームに入力されたデータの種類は何ですか？（個人情報は記載しないでください）
5. **繰り返しパターン**: 定期的に実行すべきタスクですか？
6. **API代替可能性**: この操作は公式APIで代替可能ですか？（重要）
   - 対象サービスがAPIを提供している場合は、そのAPI名を記載
   - APIを使用した方が効率的かどうかを評価

{f'追加情報: {additional_context}' if additional_context else ''}

回答は以下のJSON形式で提供してください：
```json
{{
    "purpose": "操作の目的",
    "steps": ["ステップ1", "ステップ2", ...],
    "target_site": "対象サイト名",
    "data_types": ["入力データの種類"],
    "is_recurring": true/false,
    "suggested_schedule": "推奨スケジュール（例: 毎日9時）",
    "api_alternative": {{
        "available": true/false,
        "api_name": "利用可能なAPI名（あれば）",
        "api_documentation_url": "APIドキュメントURL（わかれば）",
        "recommendation": "API使用を推奨する理由（あれば）"
    }},
    "suggested_task_prompt": "AIエージェントへの指示文",
    "questions": ["不明点や確認事項"]
}}
```
"""
            
            # 分析を実行
            response = model.generate_content([video_file, prompt])
            
            # JSONを抽出
            response_text = response.text
            json_start = response_text.find("```json")
            json_end = response_text.find("```", json_start + 7)
            
            if json_start != -1 and json_end != -1:
                json_str = response_text[json_start + 7:json_end].strip()
                analysis = json.loads(json_str)
            else:
                # JSONが見つからない場合は生のテキストを返す
                analysis = {
                    "raw_response": response_text,
                    "error": "JSONの抽出に失敗しました"
                }
            
            return {
                "success": True,
                "analysis": analysis
            }
            
        except Exception as e:
            logger.error(f"動画分析エラー: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_task_from_analysis(
        self,
        db: Session,
        analysis: dict,
        chat_history: list = None
    ) -> dict:
        """分析結果とチャット履歴からタスクを生成"""
        try:
            model = self._get_model(db)
            
            # チャット履歴を含めたプロンプト
            history_text = ""
            if chat_history:
                history_text = "\n\n過去の会話:\n" + "\n".join([
                    f"{'ユーザー' if msg['role'] == 'user' else 'AI'}: {msg['content']}"
                    for msg in chat_history
                ])
            
            prompt = f"""以下の動画分析結果とユーザーとの会話に基づいて、Browser Use AIエージェント用のタスクプロンプトを生成してください。

分析結果:
{json.dumps(analysis, ensure_ascii=False, indent=2)}
{history_text}

以下のJSON形式で回答してください：
```json
{{
    "task_name": "タスク名（簡潔に）",
    "task_description": "タスクの説明",
    "task_prompt": "AIエージェントへの詳細な指示。自然言語で、具体的なステップを含めてください。",
    "schedule_suggestion": "推奨スケジュール（cron形式: 例 '0 9 * * *' = 毎日9時）"
}}
```
"""
            
            response = model.generate_content(prompt)
            
            # JSONを抽出
            response_text = response.text
            json_start = response_text.find("```json")
            json_end = response_text.find("```", json_start + 7)
            
            if json_start != -1 and json_end != -1:
                json_str = response_text[json_start + 7:json_end].strip()
                task_data = json.loads(json_str)
            else:
                task_data = {
                    "task_name": "生成されたタスク",
                    "task_description": "",
                    "task_prompt": analysis.get("suggested_task_prompt", ""),
                    "schedule_suggestion": analysis.get("suggested_schedule", "")
                }
            
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
video_analyzer = VideoAnalyzer()

