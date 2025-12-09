"""プロジェクトチャットサービス（AIによるプロジェクト全体管理）"""
import json
import re
import mimetypes
import httpx
import aiofiles
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, Union
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.models import Project, Task, TaskTrigger, RoleGroup, Credential
from app.services.credential_manager import credential_manager
from app.services.encryption import encryption_service
from app.utils.logger import logger

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

DEFAULT_CHAT_MODEL = "gpt-5.1-codex-max"

# APIキーのパターン定義
API_KEY_PATTERNS = {
    "openai": {
        "pattern": r'\b(sk-[a-zA-Z0-9]{20,})\b',
        "name": "OpenAI API Key",
        "service_name": "openai"
    },
    "anthropic": {
        "pattern": r'\b(sk-ant-[a-zA-Z0-9\-]{20,})\b',
        "name": "Anthropic API Key",
        "service_name": "anthropic"
    },
    "google": {
        "pattern": r'\b(AIza[a-zA-Z0-9_-]{35})\b',
        "name": "Google API Key",
        "service_name": "google"
    },
    "serper": {
        "pattern": r'\b([a-f0-9]{40,})\b',  # Serper APIキーは40文字以上の16進数
        "name": "Serper API Key",
        "service_name": "serper"
    }
}


class ProjectChatService:
    """AIによるプロジェクト全体のタスク管理チャット"""
    
    def _detect_and_save_api_keys(self, db: Session, message: str, user_id: str = None) -> List[Dict]:
        """メッセージからAPIキーを検出して保存"""
        saved_keys = []
        
        # 明示的なAPIキー指定パターン
        # 例: "OpenAI: sk-xxx", "openaiのAPIキー: sk-xxx", "api key is sk-xxx"
        explicit_patterns = [
            # 日本語パターン
            (r'(?:openai|オープンAI)[\s:：のが]*(?:api\s*key|apiキー|キー)?[\s:：]*\b(sk-[a-zA-Z0-9]{20,})\b', 'openai'),
            (r'(?:anthropic|アンソロピック|claude)[\s:：のが]*(?:api\s*key|apiキー|キー)?[\s:：]*\b(sk-ant-[a-zA-Z0-9\-]{20,})\b', 'anthropic'),
            (r'(?:google|グーグル|gemini)[\s:：のが]*(?:api\s*key|apiキー|キー)?[\s:：]*\b(AIza[a-zA-Z0-9_-]{35})\b', 'google'),
            (r'(?:serper)[\s:：のが]*(?:api\s*key|apiキー|キー)?[\s:：]*\b([a-f0-9]{40,64})\b', 'serper'),
            # 英語パターン
            (r'(?:my\s+)?openai\s+(?:api\s*)?key[\s:：]+\b(sk-[a-zA-Z0-9]{20,})\b', 'openai'),
            (r'(?:my\s+)?anthropic\s+(?:api\s*)?key[\s:：]+\b(sk-ant-[a-zA-Z0-9\-]{20,})\b', 'anthropic'),
            (r'(?:my\s+)?google\s+(?:api\s*)?key[\s:：]+\b(AIza[a-zA-Z0-9_-]{35})\b', 'google'),
        ]
        
        # キー検出用の追加パターン（キー単体でも検出）
        general_patterns = {
            'openai': r'\b(sk-[a-zA-Z0-9]{20,})\b',
            'anthropic': r'\b(sk-ant-[a-zA-Z0-9\-]{20,})\b',
            'google': r'\b(AIza[a-zA-Z0-9_-]{35})\b',
        }
        
        detected_keys = {}
        
        # 明示的パターンで検出
        for pattern, service in explicit_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                api_key = match.group(1)
                if service not in detected_keys:
                    detected_keys[service] = api_key
        
        # 一般パターンで検出（明示的パターンで検出されなかった場合）
        if not detected_keys:
            for service, pattern in general_patterns.items():
                match = re.search(pattern, message)
                if match:
                    api_key = match.group(1)
                    if service not in detected_keys:
                        detected_keys[service] = api_key
        
        # 検出されたキーを保存
        for service, api_key in detected_keys.items():
            try:
                # 既存のキーをチェック
                existing = credential_manager.get_default(db, "api_key", service, user_id)
                
                # 既に同じキーが存在する場合はスキップ
                if existing and existing.get("data", {}).get("api_key") == api_key:
                    logger.info(f"APIキーは既に登録済み: {service}")
                    continue
                
                # 同じサービスの既存キーのデフォルトを解除
                db.query(Credential).filter(
                    Credential.credential_type == "api_key",
                    Credential.service_name == service,
                    Credential.is_default == True
                ).update({"is_default": False})
                
                # 新しいキーを作成
                encrypted_data = encryption_service.encrypt({"api_key": api_key})
                
                service_names = {
                    "openai": "OpenAI",
                    "anthropic": "Anthropic",
                    "google": "Google",
                    "serper": "Serper"
                }
                
                credential = Credential(
                    user_id=user_id,
                    name=f"{service_names.get(service, service)} API Key（チャットから追加）",
                    credential_type="api_key",
                    service_name=service,
                    description="チャットで提供されたAPIキーを自動保存しました",
                    is_default=True,
                    data=encrypted_data
                )
                
                db.add(credential)
                db.commit()
                db.refresh(credential)
                
                saved_keys.append({
                    "service": service,
                    "name": credential.name,
                    "id": credential.id
                })
                
                logger.info(f"APIキーを自動保存しました: {service}")
                
            except Exception as e:
                logger.error(f"APIキー保存エラー ({service}): {e}")
                db.rollback()
        
        return saved_keys
    
    def _mask_api_key(self, api_key: str) -> str:
        """APIキーをマスク（最初と最後の数文字のみ表示）"""
        if len(api_key) <= 10:
            return "*" * len(api_key)
        return api_key[:6] + "*" * (len(api_key) - 10) + api_key[-4:]
    
    def check_required_credentials(self, db: Session, task_prompt: str, execution_location: str = "server") -> Dict:
        """タスク実行に必要な認証情報が登録されているかチェック"""
        missing = []
        warnings = []
        registered = []
        
        # 基本的に必要なもの: LLM APIキー（OpenAIまたはAnthropic）
        openai_cred = credential_manager.get_default(db, "api_key", "openai")
        anthropic_cred = credential_manager.get_default(db, "api_key", "anthropic")
        
        if openai_cred:
            registered.append("OpenAI APIキー")
        if anthropic_cred:
            registered.append("Anthropic APIキー")
        
        if not openai_cred and not anthropic_cred:
            missing.append({
                "type": "api_key",
                "service": "openai または anthropic",
                "message": "AIエージェント実行にはOpenAIまたはAnthropic APIキーが必要です",
                "how_to_get": "OpenAI: https://platform.openai.com/api-keys / Anthropic: https://console.anthropic.com/settings/keys"
            })
        
        # task_promptの内容から必要な認証情報を推測
        prompt_lower = task_prompt.lower()
        
        # ログインが必要そうな場合
        login_keywords = ["ログイン", "login", "サインイン", "signin", "認証", "パスワード", "password"]
        if any(kw in prompt_lower for kw in login_keywords):
            # サイトログイン情報があるか確認
            login_creds = db.query(Credential).filter(Credential.credential_type == "login").all()
            if login_creds:
                registered.append(f"サイトログイン情報 ({len(login_creds)}件)")
            else:
                warnings.append({
                    "type": "login",
                    "message": "ログインが必要なサイトの場合、認証情報画面から「サイトログイン」を登録してください"
                })
        
        # Google系サービス
        google_keywords = ["google", "gmail", "スプレッドシート", "spreadsheet", "ドライブ", "drive", "youtube"]
        if any(kw in prompt_lower for kw in google_keywords):
            google_cred = credential_manager.get_default(db, "api_key", "google")
            if google_cred:
                registered.append("Google APIキー")
            else:
                warnings.append({
                    "type": "api_key",
                    "service": "google",
                    "message": "Google系サービスを使用する場合、Google APIキーの登録を推奨します"
                })
        
        # Twitter/X
        twitter_keywords = ["twitter", "ツイート", "tweet", "x.com"]
        if any(kw in prompt_lower for kw in twitter_keywords):
            warnings.append({
                "type": "login",
                "service": "twitter",
                "message": "Twitter/Xの操作には、ログイン情報の事前登録が必要です"
            })
        
        # ローカル実行の場合
        if execution_location == "local":
            # OAGI/Lux APIキーが必要
            oagi_cred = credential_manager.get_default(db, "api_key", "oagi")
            if oagi_cred:
                registered.append("OAGI APIキー")
            else:
                missing.append({
                    "type": "api_key",
                    "service": "oagi",
                    "message": "ローカルPC実行にはOAGI APIキーが必要です",
                    "how_to_get": "https://oagi.ai でAPIキーを取得してください"
                })
        
        return {
            "is_ready": len(missing) == 0,
            "missing": missing,
            "warnings": warnings,
            "registered": registered
        }
    
    async def review_task_prompt(self, db: Session, task_prompt: str, task_name: str) -> Dict:
        """task_promptの品質をAIでレビュー"""
        try:
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                # OpenAIキーがなければスキップ
                return {"reviewed": False, "reason": "OpenAI APIキーがないためレビューをスキップ"}
            
            api_key = cred["data"].get("api_key")
            
            review_prompt = f"""以下のタスク指示内容をレビューしてください。

タスク名: {task_name}
指示内容:
{task_prompt}

以下の観点でチェックし、JSONで回答してください：

1. 具体性: URLやサービス名が明記されているか
2. 手順の明確さ: ステップバイステップで書かれているか
3. 認証情報: ログインが必要な場合、その旨が明記されているか
4. 完了条件: 何をもって完了とするか明確か

JSON形式で回答（説明は不要）:
```json
{{
    "score": 1-10の品質スコア,
    "is_executable": true/false（このまま実行可能か）,
    "issues": ["問題点1", "問題点2"],
    "suggestions": ["改善案1", "改善案2"],
    "improved_prompt": "改善されたtask_prompt（問題がある場合のみ）"
}}
```"""

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": DEFAULT_CHAT_MODEL,
                        "max_tokens": 1000,
                        "messages": [{"role": "user", "content": review_prompt}]
                    },
                    timeout=30
                )
                
                if response.status_code != 200:
                    return {"reviewed": False, "reason": f"API Error: {response.status_code}"}
                
                result = response.json()
                response_text = result["choices"][0]["message"]["content"]
                
                # JSONを抽出
                json_start = response_text.find("```json")
                json_end = response_text.find("```", json_start + 7)
                
                if json_start != -1 and json_end != -1:
                    json_str = response_text[json_start + 7:json_end].strip()
                    review_result = json.loads(json_str)
                    review_result["reviewed"] = True
                    return review_result
                else:
                    return {"reviewed": False, "reason": "レビュー結果のパースに失敗"}
                    
        except Exception as e:
            logger.warning(f"task_promptレビューエラー: {e}")
            return {"reviewed": False, "reason": str(e)}
    
    def _build_project_context(self, project: Project, tasks: List[Task], role_groups: List[RoleGroup], triggers: List[TaskTrigger]) -> str:
        """プロジェクトのコンテキストを構築"""
        
        # 役割グループをマップ化
        group_map = {g.id: g.name for g in role_groups}
        
        # タスクをグループごとに整理
        tasks_by_group = {}
        for task in tasks:
            group_name = group_map.get(task.role_group_id) or task.role_group or "未分類"
            if group_name not in tasks_by_group:
                tasks_by_group[group_name] = []
            
            # タスクのトリガーを取得
            task_triggers = [t for t in triggers if t.task_id == task.id]
            
            # 依存関係を解析
            deps = json.loads(task.dependencies or "[]")
            dep_names = []
            for dep_id in deps:
                dep_task = next((t for t in tasks if t.id == dep_id), None)
                if dep_task:
                    dep_names.append(dep_task.name)
            
            tasks_by_group[group_name].append({
                "id": task.id,
                "name": task.name,
                "description": task.description,
                "prompt": task.task_prompt[:500] + "..." if len(task.task_prompt or "") > 500 else task.task_prompt,
                "schedule": task.schedule,
                "is_active": task.is_active,
                "execution_location": task.execution_location,
                "dependencies": dep_names,
                "triggers": [
                    {
                        "type": t.trigger_type,
                        "time": t.trigger_time,
                        "days": t.trigger_days,
                        "depends_on": next((tsk.name for tsk in tasks if tsk.id == t.depends_on_task_id), None) if t.depends_on_task_id else None,
                        "on_status": t.trigger_on_status,
                        "delay": t.delay_minutes
                    }
                    for t in task_triggers
                ]
            })
        
        # コンテキスト文字列を構築
        context = f"""## プロジェクト情報
- **名前**: {project.name}
- **説明**: {project.description or "なし"}
- **タスク数**: {len(tasks)}個
- **役割グループ**: {len(role_groups)}個

## 役割グループとタスク構成
"""
        
        for group_name, group_tasks in tasks_by_group.items():
            context += f"\n### 📁 {group_name} ({len(group_tasks)}タスク)\n"
            for task in group_tasks:
                status = "✅" if task["is_active"] else "⏸️"
                context += f"\n#### {status} タスク: {task['name']} (ID: {task['id']})\n"
                if task["description"]:
                    context += f"- 説明: {task['description']}\n"
                context += f"- 実行場所: {task['execution_location']}\n"
                if task["schedule"]:
                    context += f"- スケジュール: {task['schedule']}\n"
                if task["dependencies"]:
                    context += f"- 依存タスク: {', '.join(task['dependencies'])}\n"
                if task["triggers"]:
                    context += "- トリガー:\n"
                    for trigger in task["triggers"]:
                        if trigger["type"] == "time":
                            context += f"  - 時間: {trigger['time']} ({trigger['days']})\n"
                        elif trigger["type"] == "dependency":
                            context += f"  - {trigger['depends_on']}が{trigger['on_status']}後"
                            if trigger["delay"]:
                                context += f" ({trigger['delay']}分後)"
                            context += "\n"
                context += f"- 指示内容:\n```\n{task['prompt']}\n```\n"
        
        return context
    
    def _build_workflow_explanation(self, tasks: List[Task], triggers: List[TaskTrigger]) -> str:
        """ワークフローの説明を構築"""
        
        # タスクのマップ
        task_map = {t.id: t for t in tasks}
        
        # 依存関係グラフを構築
        dependencies = {}
        for task in tasks:
            deps = json.loads(task.dependencies or "[]")
            dependencies[task.id] = deps
        
        # トリガーベースの依存関係も追加
        for trigger in triggers:
            if trigger.trigger_type == "dependency" and trigger.depends_on_task_id:
                if trigger.task_id not in dependencies:
                    dependencies[trigger.task_id] = []
                if trigger.depends_on_task_id not in dependencies[trigger.task_id]:
                    dependencies[trigger.task_id].append(trigger.depends_on_task_id)
        
        # 実行フローを説明
        explanation = "\n## ワークフロー実行フロー\n\n"
        
        # 開始タスク（依存関係がないもの）
        start_tasks = [t for t in tasks if not dependencies.get(t.id)]
        
        if start_tasks:
            explanation += "### 🚀 開始タスク（トリガー起点）\n"
            for task in start_tasks:
                explanation += f"- **{task.name}**: "
                if task.schedule:
                    explanation += f"スケジュール実行 ({task.schedule})\n"
                else:
                    explanation += "手動実行\n"
        
        # 連鎖タスク
        chain_tasks = [t for t in tasks if dependencies.get(t.id)]
        if chain_tasks:
            explanation += "\n### 🔗 連鎖タスク（前のタスク完了後に実行）\n"
            for task in chain_tasks:
                dep_ids = dependencies.get(task.id, [])
                dep_names = [task_map[d].name for d in dep_ids if d in task_map]
                explanation += f"- **{task.name}** ← {', '.join(dep_names)} が完了後\n"
        
        return explanation
    
    async def chat(
        self,
        db: Session,
        project_id: int,
        user_message: str,
        chat_history: List[Dict] = None,
        user_id: str = None
    ) -> dict:
        """プロジェクトのコンテキストを理解したチャット"""
        try:
            # APIキーの検出と保存
            saved_keys = self._detect_and_save_api_keys(db, user_message, user_id)
            saved_keys_message = ""
            if saved_keys:
                key_names = [k['service'].upper() for k in saved_keys]
                saved_keys_message = f"\n\n以下のAPIキーを認証情報に保存しました：\n- " + "\n- ".join(key_names) + "\n\n次回以降は自動的にこのキーが使用されます。"
            
            # プロジェクトとタスクを取得
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise ValueError("プロジェクトが見つかりません")
            
            tasks = db.query(Task).filter(Task.project_id == project_id).all()
            role_groups = db.query(RoleGroup).filter(RoleGroup.project_id == project_id).all()
            
            # 全タスクのトリガーを取得
            task_ids = [t.id for t in tasks]
            triggers = db.query(TaskTrigger).filter(TaskTrigger.task_id.in_(task_ids)).all() if task_ids else []
            
            # コンテキストを構築
            project_context = self._build_project_context(project, tasks, role_groups, triggers)
            workflow_explanation = self._build_workflow_explanation(tasks, triggers)
            
            # チャット履歴を初期化または取得
            if chat_history is None:
                chat_history = []
            
            # APIキーが保存された場合、メッセージを追加
            display_message = user_message
            if saved_keys:
                # APIキーをマスクして表示
                for key_info in saved_keys:
                    pattern = API_KEY_PATTERNS.get(key_info['service'], {}).get('pattern', '')
                    if pattern:
                        display_message = re.sub(pattern, lambda m: self._mask_api_key(m.group(1)), display_message)
            
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
            
            # 登録済み認証情報を取得
            all_credentials = db.query(Credential).all()
            credential_context = "\n## 登録済みの認証情報:\n"
            if all_credentials:
                for cred in all_credentials:
                    credential_context += f"- {cred.service_name}: {cred.name} ({'デフォルト' if cred.is_default else ''})\n"
            else:
                credential_context += "- なし（認証情報が未登録です）\n"
            
            system_prompt = f"""あなたはプロジェクト「{project.name}」の自動化ワークフローを管理・改善するAIアシスタントです。

このプロジェクトには既に自動化タスクが設定されています。
あなたの役割は：
- 既存フローの説明
- ユーザーの要望に応じた改善・拡張
- 新しいタスクの追加

{project_context}

{workflow_explanation}

{credential_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【重要】新しいタスクを追加する場合
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

新しいタスクを作成する際は、必ず以下を確認してください：

1. 具体的な作業内容（何をどこで行うか）
2. 必要な認証情報が登録されているか
3. ユーザーの明示的な許可

勝手にタスクを作成しないでください。

【あなたの役割】

1. ワークフローの説明
   - タスク同士がどう連携しているか
   - トリガーや依存関係の流れ
   - 自動化で節約できる時間

2. タスクの編集
   変更が必要な場合、以下のJSON形式で出力：

```json
{{
    "actions": [
        {{
            "type": "update_task",
            "task_id": タスクID,
            "changes": {{
                "name": "新しい名前",
                "description": "新しい説明",
                "task_prompt": "新しい指示（具体的なステップを含める）",
                "schedule": "新しいスケジュール",
                "is_active": true/false,
                "role_group": "新しい役割グループ名"
            }}
        }},
        {{
            "type": "create_task",
            "data": {{
                "name": "タスク名（具体的に）",
                "description": "このタスクが何をするかの説明",
                "task_prompt": "AIエージェントへの詳細な指示（ステップバイステップで具体的に）",
                "role_group": "役割グループ名",
                "schedule": "スケジュール（cron形式）",
                "execution_location": "server または local"
            }}
        }},
        {{
            "type": "delete_task",
            "task_id": タスクID
        }},
        {{
            "type": "create_trigger",
            "task_id": タスクID,
            "trigger": {{
                "trigger_type": "time" or "dependency",
                "trigger_time": "HH:MM",
                "trigger_days": ["mon", "tue", ...],
                "depends_on_task_id": 前提タスクID,
                "trigger_on_status": "completed" or "failed" or "any",
                "delay_minutes": 遅延分
            }}
        }},
        {{
            "type": "create_role_group",
            "data": {{
                "name": "グループ名",
                "description": "説明",
                "color": "#hex色"
            }}
        }}
    ]
}}
```

【task_promptの書き方】
task_promptは具体的なステップを含めてください：
- 「〜にアクセスする」→「https://example.com にアクセスする」
- 「データを取得する」→「画面上部の『レポート』ボタンをクリックし、表示されたCSVをダウンロードする」

3. 質問への回答と改善提案
   - ワークフローに関する質問に答える
   - より効率的な自動化方法を提案
   - 問題点を指摘し改善策を提示

【文章スタイル】
- 絵文字は使わない
- 見出し記号（#や---）は使わない
- 箇条書きはシンプルに
- 日本語で回答
- 変更が必要な場合は最後にJSONアクションを含める"""

            # メッセージを構築
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend([{"role": msg["role"], "content": msg["content"]} for msg in chat_history])
            
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": DEFAULT_CHAT_MODEL,
                        "max_tokens": 2048,
                        "messages": messages
                    },
                    timeout=90
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
            
            # JSONアクションを抽出
            actions = None
            if "```json" in assistant_message:
                try:
                    json_start = assistant_message.find("```json")
                    json_end = assistant_message.find("```", json_start + 7)
                    if json_start != -1 and json_end != -1:
                        json_str = assistant_message[json_start + 7:json_end].strip()
                        actions = json.loads(json_str)
                except:
                    pass
            
            # APIキー保存メッセージを追加
            final_response = assistant_message
            if saved_keys_message:
                final_response = saved_keys_message + "\n\n" + assistant_message
            
            return {
                "response": final_response,
                "chat_history": chat_history,
                "actions": actions,
                "saved_api_keys": saved_keys,
                "project_summary": {
                    "name": project.name,
                    "task_count": len(tasks),
                    "group_count": len(role_groups)
                }
            }
            
        except Exception as e:
            logger.error(f"プロジェクトチャットエラー: {e}")
            return {
                "response": f"エラーが発生しました: {str(e)}",
                "chat_history": chat_history or [],
                "error": str(e)
            }
    
    async def execute_actions(
        self,
        db: Session,
        project_id: int,
        actions: List[Dict],
        user_id: str = None
    ) -> dict:
        """AIが提案したアクションを実行"""
        results = []
        created_tasks = []  # 作成されたタスクの詳細情報
        
        try:
            for action in actions:
                action_type = action.get("type")
                
                if action_type == "update_task":
                    task_id = action.get("task_id")
                    changes = action.get("changes", {})
                    
                    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
                    if task:
                        for key, value in changes.items():
                            if hasattr(task, key):
                                setattr(task, key, value)
                        db.commit()
                        results.append({"type": "update_task", "task_id": task_id, "success": True})
                    else:
                        results.append({"type": "update_task", "task_id": task_id, "success": False, "error": "タスクが見つかりません"})
                
                elif action_type == "create_task":
                    data = action.get("data", {})
                    task_prompt = data.get("task_prompt", "")
                    task_name = data.get("name", "")
                    
                    # バリデーション: task_promptが十分な長さか確認
                    if not task_prompt or len(task_prompt.strip()) < 20:
                        results.append({
                            "type": "create_task",
                            "success": False,
                            "error": "タスクの指示内容（task_prompt）が不十分です。具体的な手順を含めてください。"
                        })
                        continue
                    
                    # バリデーション: タスク名が空でないか
                    if not task_name or len(task_name.strip()) < 2:
                        results.append({
                            "type": "create_task",
                            "success": False,
                            "error": "タスク名が設定されていません。"
                        })
                        continue
                    
                    # スケジュールのバリデーション（設定されている場合）
                    schedule = data.get("schedule")
                    if schedule:
                        try:
                            from apscheduler.triggers.cron import CronTrigger
                            CronTrigger.from_crontab(schedule)
                        except Exception as e:
                            results.append({
                                "type": "create_task",
                                "success": False,
                                "error": f"スケジュール形式が不正です: {schedule}。cron形式で指定してください（例: 0 9 * * *）"
                            })
                            continue
                    
                    execution_location = data.get("execution_location", "server")
                    task = Task(
                        project_id=project_id,
                        user_id=user_id,
                        name=task_name.strip(),
                        description=data.get("description"),
                        task_prompt=task_prompt.strip(),
                        schedule=schedule,
                        role_group=data.get("role_group", "General"),
                        execution_location=execution_location,
                        is_active=True
                    )
                    db.add(task)
                    db.commit()
                    db.refresh(task)
                    results.append({"type": "create_task", "task_id": task.id, "success": True})
                    
                    # 作成されたタスクの詳細情報を追加
                    created_tasks.append({
                        "id": task.id,
                        "name": task.name,
                        "description": task.description,
                        "task_prompt": task.task_prompt,
                        "schedule": task.schedule,
                        "role_group": task.role_group,
                        "execution_location": task.execution_location,
                        "is_active": task.is_active
                    })
                
                elif action_type == "delete_task":
                    task_id = action.get("task_id")
                    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
                    if task:
                        db.delete(task)
                        db.commit()
                        results.append({"type": "delete_task", "task_id": task_id, "success": True})
                    else:
                        results.append({"type": "delete_task", "task_id": task_id, "success": False, "error": "タスクが見つかりません"})
                
                elif action_type == "create_trigger":
                    task_id = action.get("task_id")
                    trigger_data = action.get("trigger", {})
                    
                    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
                    if task:
                        trigger = TaskTrigger(
                            task_id=task_id,
                            trigger_type=trigger_data.get("trigger_type", "manual"),
                            trigger_time=trigger_data.get("trigger_time"),
                            trigger_days=json.dumps(trigger_data.get("trigger_days", [])),
                            depends_on_task_id=trigger_data.get("depends_on_task_id"),
                            trigger_on_status=trigger_data.get("trigger_on_status", "completed"),
                            delay_minutes=trigger_data.get("delay_minutes", 0),
                            is_active=True
                        )
                        db.add(trigger)
                        db.commit()
                        results.append({"type": "create_trigger", "task_id": task_id, "success": True})
                    else:
                        results.append({"type": "create_trigger", "task_id": task_id, "success": False, "error": "タスクが見つかりません"})
                
                elif action_type == "create_role_group":
                    data = action.get("data", {})
                    group = RoleGroup(
                        project_id=project_id,
                        user_id=user_id,
                        name=data.get("name", "新規グループ"),
                        description=data.get("description"),
                        color=data.get("color", "#6366f1")
                    )
                    db.add(group)
                    db.commit()
                    db.refresh(group)
                    results.append({"type": "create_role_group", "group_id": group.id, "success": True})
            
            return {
                "success": True,
                "results": results,
                "created_tasks": created_tasks,
                "message": f"{len(results)}件のアクションを実行しました"
            }
            
        except Exception as e:
            logger.error(f"アクション実行エラー: {e}")
            db.rollback()
            return {
                "success": False,
                "error": str(e),
                "results": results,
                "created_tasks": created_tasks
            }
    
    async def get_workflow_explanation(
        self,
        db: Session,
        project_id: int
    ) -> dict:
        """プロジェクトのワークフロー説明を生成"""
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise ValueError("プロジェクトが見つかりません")
            
            tasks = db.query(Task).filter(Task.project_id == project_id).all()
            role_groups = db.query(RoleGroup).filter(RoleGroup.project_id == project_id).all()
            
            task_ids = [t.id for t in tasks]
            triggers = db.query(TaskTrigger).filter(TaskTrigger.task_id.in_(task_ids)).all() if task_ids else []
            
            context = self._build_project_context(project, tasks, role_groups, triggers)
            workflow = self._build_workflow_explanation(tasks, triggers)
            
            # OpenAI APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                # APIキーがない場合は基本的な説明を返す
                return {
                    "explanation": context + workflow,
                    "has_ai_analysis": False
                }
            
            api_key = cred["data"].get("api_key")
            
            prompt = f"""以下のプロジェクトのワークフローを、分かりやすく説明してください。
各タスクがどのように連携しているか、全体の流れを説明してください。

{context}
{workflow}

## 説明に含めること:
1. プロジェクトの全体的な目的
2. 各役割グループの責任
3. タスクの実行順序と依存関係
4. 自動化のフロー（トリガー → タスク → 次のタスク）
5. 改善できる点があれば提案

日本語で、絵文字を使って親しみやすく説明してください。"""

            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": DEFAULT_CHAT_MODEL,
                        "max_tokens": 1500,
                        "messages": [{"role": "user", "content": prompt}]
                    },
                    timeout=60
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code}")
                
                result = response.json()
                explanation = result["choices"][0]["message"]["content"]
            
            return {
                "explanation": explanation,
                "raw_context": context + workflow,
                "has_ai_analysis": True
            }
            
        except Exception as e:
            logger.error(f"ワークフロー説明エラー: {e}")
            return {
                "explanation": f"説明の生成に失敗しました: {str(e)}",
                "has_ai_analysis": False,
                "error": str(e)
            }


    # ==================== Webリサーチ機能 ====================
    
    async def web_search(self, db: Session, query: str, num_results: int = 5) -> dict:
        """Webリサーチを実行"""
        try:
            # Serper API (Google Search) を使用
            cred = credential_manager.get_default(db, "api_key", "serper")
            
            if cred:
                api_key = cred["data"].get("api_key")
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://google.serper.dev/search",
                        headers={
                            "X-API-KEY": api_key,
                            "Content-Type": "application/json"
                        },
                        json={
                            "q": query,
                            "num": num_results
                        },
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        results = []
                        for item in data.get("organic", [])[:num_results]:
                            results.append({
                                "title": item.get("title"),
                                "url": item.get("link"),
                                "snippet": item.get("snippet")
                            })
                        return {"success": True, "results": results, "source": "serper"}
            
            # Serper APIがない場合、OpenAIのBrowsing機能を使用
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                return {"success": False, "error": "検索APIキーが設定されていません"}
            
            api_key = cred["data"].get("api_key")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": DEFAULT_CHAT_MODEL,
                        "max_tokens": 1500,
                        "messages": [
                            {
                                "role": "system",
                                "content": "あなたはWebリサーチアシスタントです。与えられたトピックについて、最新の情報や関連する情報をまとめてください。"
                            },
                            {
                                "role": "user",
                                "content": f"以下のトピックについて調べてください：{query}\n\n最新のトレンド、関連する情報、役立つリソースをまとめてください。"
                            }
                        ]
                    },
                    timeout=60
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "results": [{"title": "AI分析結果", "content": result["choices"][0]["message"]["content"]}],
                        "source": "openai"
                    }
            
            return {"success": False, "error": "検索に失敗しました"}
            
        except Exception as e:
            logger.error(f"Webリサーチエラー: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== 汎用ファイル分析機能 ====================
    
    def _read_text_preview(self, file_path: Path, max_bytes: int = 4000) -> Optional[str]:
        try:
            data = file_path.read_bytes()[:max_bytes]
            for enc in ["utf-8", "utf-8-sig", "shift_jis", "cp932", "latin-1"]:
                try:
                    return data.decode(enc)
                except Exception:
                    continue
            return data.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.warning(f"テキストプレビュー取得エラー: {e}")
            return None
    
    def _summarize_text_preview(self, text_preview: str) -> str:
        sample = (text_preview or "").strip()
        if not sample:
            return ""
        
        lowered = sample.lower()
        if sample.startswith("{") or sample.startswith("["):
            return "JSONまたは構造化データの可能性があります"
        if "," in sample and "\n" in sample:
            return "表形式（CSV/TSV）の可能性があります"
        if "error" in lowered or "exception" in lowered or "エラー" in sample:
            return "ログ/エラーログの可能性があります"
        if len(sample) > 0 and len(sample.split()) < 80:
            return "短文テキストです"
        return "テキストファイルです"
    
    def _infer_intent_from_text(self, context: str, text_preview: Optional[str]) -> List[str]:
        hints = []
        combined = f"{context}\n{text_preview or ''}".lower()
        if any(kw in combined for kw in ["error", "exception", "stack", "trace", "ログ", "失敗"]):
            hints.append("不具合調査")
        if any(kw in combined for kw in ["仕様", "spec", "要件", "design"]):
            hints.append("仕様確認")
        if any(kw in combined for kw in ["csv", "excel", "spreadsheet", "表", "一覧"]):
            hints.append("データ取り込み/加工")
        if any(kw in combined for kw in ["report", "レポート", "分析", "analytics"]):
            hints.append("レポート生成/分析")
        return hints
    
    async def analyze_file_for_project(
        self,
        db: Session,
        project_id: int,
        file_path: str,
        original_name: str,
        context: str = ""
    ) -> dict:
        """プロジェクト用に汎用ファイルを簡易分析"""
        try:
            path = Path(file_path)
            mime, _ = mimetypes.guess_type(original_name)
            extension = path.suffix.lower()
            size_bytes = path.stat().st_size if path.exists() else None
            
            text_preview = None
            summary = ""
            kind = mime or extension or "unknown"
            
            text_like_ext = {".txt", ".md", ".csv", ".tsv", ".json", ".log", ".yaml", ".yml"}
            doc_like_ext = {".pdf", ".doc", ".docx"}
            sheet_like_ext = {".xlsx", ".xls"}
            
            if mime and mime.startswith("text"):
                text_preview = self._read_text_preview(path)
            elif extension in text_like_ext:
                text_preview = self._read_text_preview(path)
            elif extension in doc_like_ext:
                summary = "ドキュメントファイルです（内容の抽出は簡易対応）"
            elif extension in sheet_like_ext:
                summary = "スプレッドシート/Excelファイルです（内容の抽出は未対応）"
            
            if not summary and text_preview:
                summary = self._summarize_text_preview(text_preview)
            
            intent_hints = self._infer_intent_from_text(context, text_preview)
            
            return {
                "success": True,
                "summary": summary or "ファイルを受信しました。",
                "file": {
                    "name": original_name,
                    "mime": mime,
                    "extension": extension,
                    "size_bytes": size_bytes,
                    "kind": kind
                },
                "text_preview": text_preview[:800] if text_preview else None,
                "intent_hints": intent_hints
            }
        except Exception as e:
            logger.error(f"汎用ファイル分析エラー: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== 動画分析機能 ====================
    
    async def analyze_video_for_project(
        self,
        db: Session,
        project_id: int,
        video_path: str,
        context: str = ""
    ) -> dict:
        """プロジェクト用に動画を分析"""
        try:
            import google.generativeai as genai
            
            # Google APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "google")
            if not cred:
                raise ValueError("Google APIキーが設定されていません")
            
            api_key = cred["data"].get("api_key")
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-pro")
            
            # プロジェクト情報を取得
            project = db.query(Project).filter(Project.id == project_id).first()
            project_context = f"プロジェクト: {project.name}" if project else ""
            
            # 動画ファイルをアップロード
            video_file = genai.upload_file(path=video_path)
            
            prompt = f"""この動画を分析して、自動化タスクの作成に役立つ情報を抽出してください。

{project_context}
{f'追加コンテキスト: {context}' if context else ''}

## 分析してください：
1. **動画の内容**: 何を説明/デモしていますか？
2. **自動化の候補**: この内容から自動化できる作業は何ですか？
3. **必要なタスク**: どのようなタスクを作成すべきですか？
4. **役割グループ**: タスクをどのように分類すべきですか？
5. **実行順序**: タスクの依存関係や実行順序は？
6. **注意点**: 自動化する際の注意点は？

JSON形式で回答してください：
```json
{{
    "summary": "動画の概要",
    "automation_candidates": ["自動化候補1", "自動化候補2"],
    "suggested_tasks": [
        {{
            "name": "タスク名",
            "description": "説明",
            "prompt": "AIエージェントへの指示",
            "role_group": "役割グループ名",
            "depends_on": "依存タスク名（あれば）"
        }}
    ],
    "suggested_groups": [
        {{
            "name": "グループ名",
            "description": "説明",
            "color": "#カラーコード"
        }}
    ],
    "workflow_explanation": "ワークフロー全体の説明",
    "notes": ["注意点1", "注意点2"]
}}
```"""
            
            response = model.generate_content([video_file, prompt])
            
            # JSONを抽出
            response_text = response.text
            json_start = response_text.find("```json")
            json_end = response_text.find("```", json_start + 7)
            
            if json_start != -1 and json_end != -1:
                json_str = response_text[json_start + 7:json_end].strip()
                analysis = json.loads(json_str)
            else:
                analysis = {"raw_response": response_text}
            
            return {
                "success": True,
                "analysis": analysis,
                "raw_response": response_text
            }
            
        except Exception as e:
            logger.error(f"動画分析エラー: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== 空プロジェクト用ウィザードチャット ====================
    
    async def wizard_chat_for_new_project(
        self,
        db: Session,
        project_id: int,
        user_message: str,
        chat_history: List[Dict] = None,
        video_analysis: Dict = None,
        web_research: Any = None,  # list または dict を許容
        user_id: str = None
    ) -> dict:
        """空のプロジェクトでワークフローを構築するためのウィザードチャット"""
        try:
            # APIキーの検出と保存
            saved_keys = self._detect_and_save_api_keys(db, user_message, user_id)
            saved_keys_message = ""
            if saved_keys:
                key_names = [k['service'].upper() for k in saved_keys]
                saved_keys_message = f"\n\n以下のAPIキーを認証情報に保存しました：\n- " + "\n- ".join(key_names) + "\n\n次回以降は自動的にこのキーが使用されます。"
            
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise ValueError("プロジェクトが見つかりません")
            
            # 既存のタスクとグループを取得
            tasks = db.query(Task).filter(Task.project_id == project_id).all()
            role_groups = db.query(RoleGroup).filter(RoleGroup.project_id == project_id).all()
            
            if chat_history is None:
                chat_history = []
            
            chat_history.append({"role": "user", "content": user_message})
            
            # OpenAI APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                raise ValueError("OpenAI APIキーが設定されていません")
            
            api_key = cred["data"].get("api_key")
            
            # コンテキストを構築
            additional_context = ""
            if video_analysis:
                additional_context += f"\n\n## アップロードされた動画の分析結果:\n{json.dumps(video_analysis, ensure_ascii=False, indent=2)}"
            if web_research:
                additional_context += f"\n\n## Webリサーチ結果:\n{json.dumps(web_research, ensure_ascii=False, indent=2)}"
            
            existing_context = ""
            if tasks:
                existing_context += f"\n\n## 現在のタスク ({len(tasks)}個):\n"
                for t in tasks:
                    existing_context += f"- {t.name}: {t.description or '説明なし'}\n"
            if role_groups:
                existing_context += f"\n\n## 現在の役割グループ ({len(role_groups)}個):\n"
                for g in role_groups:
                    existing_context += f"- {g.name}: {g.description or '説明なし'}\n"
            
            # 登録済み認証情報を取得
            all_credentials = db.query(Credential).all()
            credential_context = "\n\n## 登録済みの認証情報:\n"
            if all_credentials:
                for cred in all_credentials:
                    credential_context += f"- {cred.service_name}: {cred.name} ({'デフォルト' if cred.is_default else ''})\n"
            else:
                credential_context += "- なし（認証情報が未登録です）\n"
            
            system_prompt = f"""あなたはプロジェクト「{project.name}」の自動化フローを作成するAIアシスタントです。

{existing_context}
{credential_context}
{additional_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール】絶対にタスクを勝手に作成しないでください
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下の情報が全て揃うまで、JSONアクションを出力してはいけません：

1. 自動化の目的と具体的な作業内容
2. 対象サービス・サイト（URL、サービス名など）
3. 実行頻度（毎日、毎週、手動など）
4. 必要な認証情報の確認（下記参照）
5. ユーザーからの明示的な作成許可（「作成して」「お願い」など）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【認証情報の確認】必ず確認してください
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

タスク実行には認証情報が必要です。以下を必ず確認してください：

■ Web操作（ログインが必要なサイト）の場合：
  - サイトのログイン情報（ID/パスワード）は登録済みですか？
  - 「認証情報」画面から事前登録が必要です

■ API利用の場合：
  - 必要なAPIキーは登録済みですか？
  - 未登録の場合、チャットでキーを貼り付けるか、認証情報画面で登録するよう案内してください

■ AIエージェント実行の場合：
  - Anthropic APIキー（Claude用）またはOpenAI APIキーが必要
  - デスクトップ操作にはOAGI APIキーも必要

登録済みの認証情報は上記「登録済みの認証情報」セクションで確認できます。
必要なものが不足している場合は、ユーザーに設定を促してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【会話の進め方】このステップを必ず踏んでください
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: ヒアリング（最低3回のやり取り）
- 何を自動化したいですか？
- どのサービス・サイトを使いますか？（具体的なURL）
- どのくらいの頻度で実行しますか？
- 現在どのように作業していますか？

STEP 2: 認証情報の確認
- 必要なAPIキーは登録されていますか？
- サイトログイン情報は登録されていますか？
- 不足があれば登録方法を案内

STEP 3: 全体像の説明
- 「以下のタスクを作成します」と説明
- 各タスクの役割を説明
- 作成するタスク数を明示

STEP 4: 作成許可の確認
- 「この内容で作成してよろしいですか？」と必ず確認
- ユーザーが明示的に許可するまで待つ

STEP 5: タスク作成（許可後のみ）
- 1つずつ作成
- 作成後「次に進みますか？」と確認

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【task_promptの書き方】具体的に書いてください
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

task_prompt（AIエージェントへの指示）は以下を含む詳細なものにしてください：

良い例：
「Chromeブラウザを開いて https://example.com にアクセスする。
ログイン画面が表示されたら、登録済みの認証情報を使ってログインする。
ダッシュボードから「レポート」→「日次レポート」をクリック。
表示されたデータをコピーして、Googleスプレッドシートに貼り付ける。
スプレッドシートのURLは https://docs.google.com/... 」

悪い例：
「サイトからデータを取得する」（具体性がない）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Webリサーチが必要な場合】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```json
{{"web_search": {{"query": "検索クエリ", "reason": "調べる理由"}}}}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【タスク作成時のJSON形式】許可を得てから出力
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```json
{{
    "actions": [
        {{
            "type": "create_task",
            "data": {{
                "name": "タスク名（具体的に）",
                "description": "このタスクが何をするかの説明",
                "task_prompt": "AIエージェントへの詳細な指示（ステップバイステップで）",
                "role_group": "役割グループ名",
                "schedule": "cron形式（例: 0 9 * * * = 毎日9時）または空文字",
                "execution_location": "server（Web操作）または local（デスクトップ操作）"
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

【文章スタイル】
- 絵文字は使わない
- 見出し記号（#や---）は使わない
- 箇条書きはシンプルに
- 日本語で回答
- 丁寧だが堅苦しくない"""

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
                        "model": DEFAULT_CHAT_MODEL,
                        "max_tokens": 2500,
                        "messages": messages
                    },
                    timeout=90
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code}")
                
                result = response.json()
                assistant_message = result["choices"][0]["message"]["content"]
            
            chat_history.append({"role": "assistant", "content": assistant_message})
            
            # アクションとWebリサーチリクエストを抽出
            actions = None
            web_search_request = None
            
            if "```json" in assistant_message:
                try:
                    json_start = assistant_message.find("```json")
                    json_end = assistant_message.find("```", json_start + 7)
                    if json_start != -1 and json_end != -1:
                        json_str = assistant_message[json_start + 7:json_end].strip()
                        parsed = json.loads(json_str)
                        
                        if "web_search" in parsed:
                            web_search_request = parsed["web_search"]
                        elif "actions" in parsed:
                            actions = parsed
                except:
                    pass
            
            # APIキー保存メッセージを追加
            final_response = assistant_message
            if saved_keys_message:
                final_response = saved_keys_message + "\n\n" + assistant_message
            
            return {
                "response": final_response,
                "chat_history": chat_history,
                "actions": actions,
                "web_search_request": web_search_request,
                "saved_api_keys": saved_keys,
                "project_summary": {
                    "name": project.name,
                    "task_count": len(tasks),
                    "group_count": len(role_groups)
                }
            }
            
        except Exception as e:
            logger.error(f"ウィザードチャットエラー: {e}")
            return {
                "response": f"エラーが発生しました: {str(e)}",
                "chat_history": chat_history or [],
                "error": str(e)
            }
    
    # ==================== タスク個別チャット ====================
    
    async def task_chat(
        self,
        db: Session,
        task_id: int,
        user_message: str,
        chat_history: List[Dict] = None,
        user_id: str = None
    ) -> dict:
        """個別タスクのロジックを理解したチャット"""
        try:
            # APIキーの検出と保存
            saved_keys = self._detect_and_save_api_keys(db, user_message, user_id)
            saved_keys_message = ""
            if saved_keys:
                key_names = [k['service'].upper() for k in saved_keys]
                saved_keys_message = f"\n\n以下のAPIキーを認証情報に保存しました：\n- " + "\n- ".join(key_names) + "\n\n次回以降は自動的にこのキーが使用されます。"
            
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task:
                raise ValueError("タスクが見つかりません")
            
            # タスクのトリガーを取得
            triggers = db.query(TaskTrigger).filter(TaskTrigger.task_id == task_id).all()
            
            # 依存タスクを取得
            deps = json.loads(task.dependencies or "[]")
            dep_tasks = db.query(Task).filter(Task.id.in_(deps)).all() if deps else []
            
            # このタスクに依存しているタスク
            dependent_tasks = db.query(Task).filter(
                Task.project_id == task.project_id
            ).all()
            dependents = [t for t in dependent_tasks if task_id in json.loads(t.dependencies or "[]")]
            
            if chat_history is None:
                chat_history = []
            
            chat_history.append({"role": "user", "content": user_message})
            
            # OpenAI APIキーを取得
            cred = credential_manager.get_default(db, "api_key", "openai")
            if not cred:
                raise ValueError("OpenAI APIキーが設定されていません")
            
            api_key = cred["data"].get("api_key")
            
            # タスクコンテキストを構築
            task_context = f"""【タスク情報】
- 名前: {task.name}
- 説明: {task.description or "なし"}
- ステータス: {"有効" if task.is_active else "無効"}
- 実行場所: {task.execution_location}
- スケジュール: {task.schedule or "手動実行"}
- 役割グループ: {task.role_group or "未分類"}

【指示内容】
{task.task_prompt}

【トリガー設定】
"""
            if triggers:
                for t in triggers:
                    if t.trigger_type == "time":
                        task_context += f"- 時間トリガー: {t.trigger_time} ({t.trigger_days})\n"
                    elif t.trigger_type == "dependency":
                        dep_task = db.query(Task).filter(Task.id == t.depends_on_task_id).first()
                        task_context += f"- 依存トリガー: {dep_task.name if dep_task else 'Unknown'}が{t.trigger_on_status}後"
                        if t.delay_minutes:
                            task_context += f" ({t.delay_minutes}分後)"
                        task_context += "\n"
            else:
                task_context += "- なし\n"
            
            task_context += "\n【依存関係】\n"
            if dep_tasks:
                task_context += "前提タスク（このタスクの前に実行）:\n"
                for dt in dep_tasks:
                    task_context += f"- {dt.name}\n"
            if dependents:
                task_context += "後続タスク（このタスクの後に実行）:\n"
                for dt in dependents:
                    task_context += f"- {dt.name}\n"
            if not dep_tasks and not dependents:
                task_context += "- 依存関係なし（独立タスク）\n"
            
            system_prompt = f"""あなたはタスク「{task.name}」の自動化ロジックを調整するアシスタントです。

このタスクはユーザーの作業を自動化するために存在します。
あなたの役割：
- タスクの動作を説明する
- ユーザーの要望に応じて設定を調整する
- より効率的な方法を提案する

{task_context}

【あなたの役割】

1. タスクの説明
   - 何を自動化しているか
   - 指示内容の解説
   - 実行フローの説明

2. 調整の支援
   変更が必要な場合、以下のJSON形式で出力：

```json
{{
    "actions": [
        {{
            "type": "update_task",
            "task_id": {task_id},
            "changes": {{
                "name": "新しい名前",
                "description": "新しい説明",
                "task_prompt": "新しい指示",
                "schedule": "新しいスケジュール",
                "is_active": true/false
            }}
        }},
        {{
            "type": "create_trigger",
            "task_id": {task_id},
            "trigger": {{
                "trigger_type": "time or dependency",
                "trigger_time": "HH:MM",
                "trigger_days": ["mon", "tue"],
                "depends_on_task_id": 前提タスクID,
                "trigger_on_status": "completed",
                "delay_minutes": 0
            }}
        }}
    ]
}}
```

3. 改善提案
   - 指示内容の曖昧な部分を指摘
   - より効率的な方法を提案

【文章スタイル】
- 絵文字は使わない
- 見出し記号（#や---）は使わない
- 箇条書きはシンプルに
- 日本語で回答"""

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
                        "model": DEFAULT_CHAT_MODEL,
                        "max_tokens": 2048,
                        "messages": messages
                    },
                    timeout=90
                )
                
                if response.status_code != 200:
                    raise Exception(f"API Error: {response.status_code}")
                
                result = response.json()
                assistant_message = result["choices"][0]["message"]["content"]
            
            chat_history.append({"role": "assistant", "content": assistant_message})
            
            # アクションを抽出
            actions = None
            if "```json" in assistant_message:
                try:
                    json_start = assistant_message.find("```json")
                    json_end = assistant_message.find("```", json_start + 7)
                    if json_start != -1 and json_end != -1:
                        json_str = assistant_message[json_start + 7:json_end].strip()
                        actions = json.loads(json_str)
                except:
                    pass
            
            # APIキー保存メッセージを追加
            final_response = assistant_message
            if saved_keys_message:
                final_response = saved_keys_message + "\n\n" + assistant_message
            
            return {
                "response": final_response,
                "chat_history": chat_history,
                "actions": actions,
                "saved_api_keys": saved_keys,
                "task_info": {
                    "id": task.id,
                    "name": task.name,
                    "is_active": task.is_active,
                    "schedule": task.schedule
                }
            }
            
        except Exception as e:
            logger.error(f"タスクチャットエラー: {e}")
            return {
                "response": f"エラーが発生しました: {str(e)}",
                "chat_history": chat_history or [],
                "error": str(e)
            }
    
    async def execute_task_actions(
        self,
        db: Session,
        task_id: int,
        actions: List[Dict]
    ) -> dict:
        """タスクチャットで提案されたアクションを実行"""
        results = []
        
        try:
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task:
                return {"success": False, "error": "タスクが見つかりません"}
            
            for action in actions:
                action_type = action.get("type")
                
                if action_type == "update_task":
                    changes = action.get("changes", {})
                    for key, value in changes.items():
                        if hasattr(task, key) and value is not None:
                            setattr(task, key, value)
                    db.commit()
                    results.append({"type": "update_task", "success": True})
                
                elif action_type == "create_trigger":
                    trigger_data = action.get("trigger", {})
                    trigger = TaskTrigger(
                        task_id=task_id,
                        trigger_type=trigger_data.get("trigger_type", "manual"),
                        trigger_time=trigger_data.get("trigger_time"),
                        trigger_days=json.dumps(trigger_data.get("trigger_days", [])) if trigger_data.get("trigger_days") else None,
                        depends_on_task_id=trigger_data.get("depends_on_task_id"),
                        trigger_on_status=trigger_data.get("trigger_on_status", "completed"),
                        delay_minutes=trigger_data.get("delay_minutes", 0),
                        is_active=True
                    )
                    db.add(trigger)
                    db.commit()
                    results.append({"type": "create_trigger", "success": True})
                
                elif action_type == "delete_trigger":
                    trigger_id = action.get("trigger_id")
                    trigger = db.query(TaskTrigger).filter(
                        TaskTrigger.id == trigger_id,
                        TaskTrigger.task_id == task_id
                    ).first()
                    if trigger:
                        db.delete(trigger)
                        db.commit()
                        results.append({"type": "delete_trigger", "success": True})
            
            return {
                "success": True,
                "results": results,
                "message": f"{len(results)}件の変更を適用しました"
            }
            
        except Exception as e:
            logger.error(f"タスクアクション実行エラー: {e}")
            db.rollback()
            return {"success": False, "error": str(e), "results": results}


# シングルトンインスタンス
project_chat_service = ProjectChatService()

