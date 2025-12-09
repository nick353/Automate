"""プロジェクトチャットサービス（AIによるプロジェクト全体管理）"""
import json
import re
import httpx
import aiofiles
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.models import Project, Task, TaskTrigger, RoleGroup, Credential
from app.services.credential_manager import credential_manager
from app.services.encryption import encryption_service
from app.utils.logger import logger

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

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
                key_names = [f"**{k['service'].upper()}**" for k in saved_keys]
                saved_keys_message = f"\n\n✅ 以下のAPIキーを認証情報に保存しました（デフォルト設定）:\n- " + "\n- ".join(key_names) + "\n\n次回以降は自動的にこのキーが使用されます。"
            
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
            
            system_prompt = f"""あなたはプロジェクト「{project.name}」の**自動化ワークフロー作成を支援する**AIアシスタントです。

## 🎯 最重要：あなたの使命
**ユーザーが効率的な自動化フローを構築できるよう支援すること**

このシステムは、ユーザーの繰り返し作業を自動化するためのワークフローを管理しています。
あなたの役割は：
1. 既存の自動化フローを分かりやすく説明する
2. ユーザーの要望に応じてフローを改善・拡張する
3. より効率的な自動化の方法を提案する

{project_context}

{workflow_explanation}

## あなたの役割

### 1. ワークフローの説明
- プロジェクト内のタスクがどのように連携して**作業を自動化**しているか説明
- 各役割グループの責任範囲を説明
- トリガーと依存関係による実行フローを解説
- **この自動化によってユーザーがどれだけ時間を節約できるか**を伝える

### 2. タスクの編集支援
ユーザーからの指示に基づいて、自動化フローの変更を提案します。
変更が必要な場合は、以下のJSON形式で出力してください：

```json
{{
    "actions": [
        {{
            "type": "update_task",
            "task_id": タスクID,
            "changes": {{
                "name": "新しい名前",
                "description": "新しい説明",
                "task_prompt": "新しい指示",
                "schedule": "新しいスケジュール",
                "is_active": true/false,
                "role_group": "新しい役割グループ名"
            }}
        }},
        {{
            "type": "create_task",
            "data": {{
                "name": "タスク名",
                "description": "説明",
                "task_prompt": "指示",
                "role_group": "役割グループ名",
                "schedule": "スケジュール"
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

### 3. 質問への回答と改善提案
- ワークフローに関する質問に答える
- **より効率的な自動化方法**を提案する
- 問題点を指摘し、改善策を提示する
- ユーザーの作業負担をさらに減らすアイデアを提供

## レスポンスのルール
1. まず自然言語で説明・提案を行う
2. 変更が必要な場合は、最後にJSONアクションを含める
3. 日本語で回答
4. 絵文字を適度に使用
5. 変更は確認を取ってから実行するよう促す
6. **自動化によるメリット**を具体的に伝える"""

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
                        "model": "gpt-4.1",
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
                final_response = saved_keys_message + "\n\n---\n\n" + assistant_message
            
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
                    task = Task(
                        project_id=project_id,
                        user_id=user_id,
                        name=data.get("name", "新規タスク"),
                        description=data.get("description"),
                        task_prompt=data.get("task_prompt", ""),
                        schedule=data.get("schedule"),
                        role_group=data.get("role_group", "General"),
                        is_active=True
                    )
                    db.add(task)
                    db.commit()
                    db.refresh(task)
                    results.append({"type": "create_task", "task_id": task.id, "success": True})
                
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
                "message": f"{len(results)}件のアクションを実行しました"
            }
            
        except Exception as e:
            logger.error(f"アクション実行エラー: {e}")
            db.rollback()
            return {
                "success": False,
                "error": str(e),
                "results": results
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
                        "model": "gpt-4.1",
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
                        "model": "gpt-4.1",
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
        web_research: Dict = None,
        user_id: str = None
    ) -> dict:
        """空のプロジェクトでワークフローを構築するためのウィザードチャット"""
        try:
            # APIキーの検出と保存
            saved_keys = self._detect_and_save_api_keys(db, user_message, user_id)
            saved_keys_message = ""
            if saved_keys:
                key_names = [f"**{k['service'].upper()}**" for k in saved_keys]
                saved_keys_message = f"\n\n✅ 以下のAPIキーを認証情報に保存しました（デフォルト設定）:\n- " + "\n- ".join(key_names) + "\n\n次回以降は自動的にこのキーが使用されます。"
            
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
            
            system_prompt = f"""あなたは**自動化ワークフロー構築**の専門家AIアシスタントです。
ユーザーが新しいプロジェクト「{project.name}」の**自動化フローを作成する**のを手伝います。

## 🎯 最重要：あなたの使命
**ユーザーの繰り返し作業を自動化するワークフローを一緒に設計すること**

ユーザーは以下のような作業を自動化したいと考えています：
- 定期的なデータ収集・レポート作成
- 複数サービス間の連携
- 手作業で行っている定型業務
- 情報の監視・通知

あなたの役割は、これらの作業を**完全に自動化**するワークフローを設計することです。

{existing_context}
{additional_context}

## あなたの役割

### 1. ヒアリング
- ユーザーが**どんな作業を自動化したいのか**を正確に理解する
- 「今その作業をどのように行っていますか？」と現状を確認
- 「どのサービスを使いますか？」「どのくらいの頻度で実行しますか？」など具体的に質問
- **ユーザーの時間をどれだけ節約できるか**を常に意識

### 2. Webリサーチ提案
トレンドやベストプラクティスを調べる必要がある場合は、以下の形式で提案：
```json
{{"web_search": {{"query": "検索クエリ", "reason": "調べる理由"}}}}
```

### 3. ワークフロー設計
要件が明確になったら、**自動化フロー**として以下を提案：
- 必要な役割グループ（チーム分け）
- 各グループに必要な自動化タスク
- タスク間の依存関係と実行順序
- 推奨スケジュール
- **自動化により節約できる時間の見積もり**

### 4. タスク作成
ワークフローが確定したら、以下のJSON形式で作成を提案：

```json
{{
    "actions": [
        {{
            "type": "create_role_group",
            "data": {{
                "name": "グループ名",
                "description": "説明",
                "color": "#6366f1"
            }}
        }},
        {{
            "type": "create_task",
            "data": {{
                "name": "タスク名",
                "description": "説明",
                "task_prompt": "AIエージェントへの詳細な指示（自然言語）",
                "role_group": "役割グループ名",
                "schedule": "cron形式（例: 0 9 * * *）",
                "execution_location": "server または local"
            }}
        }},
        {{
            "type": "create_trigger",
            "task_id": "new_task_名前",
            "trigger": {{
                "trigger_type": "dependency",
                "depends_on_task_name": "前提タスク名",
                "trigger_on_status": "completed",
                "delay_minutes": 0
            }}
        }}
    ]
}}
```

## 提案の例

ユーザーが「SNSマーケティングの自動化」を希望した場合：
1. SNS広告担当グループ：投稿作成、スケジュール投稿
2. リサーチ担当グループ：トレンド調査、競合分析
3. データ分析担当グループ：エンゲージメント分析、レポート作成

→ これにより「週5時間かかっていた作業が30分に短縮」など具体的なメリットを伝える

## レスポンスのルール
1. 絵文字を使って親しみやすく
2. 箇条書きで分かりやすく
3. 不明点は必ず質問
4. 日本語で回答
5. 実行前に確認を取る
6. **自動化によるメリット**を具体的に伝える"""

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
                        "model": "gpt-4.1",
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
                final_response = saved_keys_message + "\n\n---\n\n" + assistant_message
            
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
                key_names = [f"**{k['service'].upper()}**" for k in saved_keys]
                saved_keys_message = f"\n\n✅ 以下のAPIキーを認証情報に保存しました（デフォルト設定）:\n- " + "\n- ".join(key_names) + "\n\n次回以降は自動的にこのキーが使用されます。"
            
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
            task_context = f"""## タスク情報
- **名前**: {task.name}
- **説明**: {task.description or "なし"}
- **ステータス**: {"有効" if task.is_active else "無効"}
- **実行場所**: {task.execution_location}
- **スケジュール**: {task.schedule or "手動実行"}
- **役割グループ**: {task.role_group or "未分類"}

## 指示内容（プロンプト）
```
{task.task_prompt}
```

## トリガー設定
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
            
            task_context += "\n## 依存関係\n"
            if dep_tasks:
                task_context += "**前提タスク（このタスクの前に実行）:**\n"
                for dt in dep_tasks:
                    task_context += f"- {dt.name}\n"
            if dependents:
                task_context += "**後続タスク（このタスクの後に実行）:**\n"
                for dt in dependents:
                    task_context += f"- {dt.name}\n"
            if not dep_tasks and not dependents:
                task_context += "- 依存関係なし（独立タスク）\n"
            
            system_prompt = f"""あなたはタスク「{task.name}」の**自動化ロジックを調整する**専門アシスタントです。
このタスクのロジックと設定を完全に理解しています。

## 🎯 最重要：あなたの使命
**このタスクはユーザーの作業を自動化するために存在します**

このタスクは、ユーザーが以前手動で行っていた作業を自動実行するものです。
あなたの役割は：
1. このタスクがどのような作業を自動化しているか説明する
2. ユーザーの要望に応じてタスクの設定を調整する
3. より効率的な自動化方法を提案する

{task_context}

## あなたの役割

### 1. タスクの説明
- このタスクが**どんな作業を自動化しているか**説明
- 指示内容（プロンプト）の解説
- 実行フローの説明
- **このタスクによって節約できる時間や労力**を伝える

### 2. 微調整の支援
ユーザーが調整したい場合、以下のJSON形式で変更を提案：

```json
{{
    "actions": [
        {{
            "type": "update_task",
            "task_id": {task_id},
            "changes": {{
                "name": "新しい名前（変更する場合）",
                "description": "新しい説明（変更する場合）",
                "task_prompt": "新しい指示（変更する場合）",
                "schedule": "新しいスケジュール（変更する場合）",
                "is_active": true/false（変更する場合）
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

### 3. 問題の特定と改善提案
- 指示内容の曖昧な部分を指摘
- **より効率的な自動化方法**を提案
- エラーが起きそうな箇所の警告
- ユーザーの作業をさらに楽にするアイデアを提供

## レスポンスのルール
1. 日本語で回答
2. 技術的な内容も分かりやすく説明
3. 変更は確認を取ってから
4. 絵文字で親しみやすく
5. **自動化によるメリット**を常に意識して伝える"""

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
                        "model": "gpt-4.1",
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
                final_response = saved_keys_message + "\n\n---\n\n" + assistant_message
            
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

