"""通知サービス"""
import httpx
from typing import Optional
from sqlalchemy.orm import Session

from app.models import Task, Execution
from app.services.credential_manager import credential_manager
from app.utils.logger import logger


class NotificationService:
    """Slack・メールによる通知を担当"""
    
    async def notify_execution_result(
        self,
        db: Session,
        task: Task,
        execution: Execution
    ):
        """実行結果を通知"""
        # 通知が必要か確認
        if execution.status == "completed" and not task.notify_on_success:
            return
        if execution.status == "failed" and not task.notify_on_failure:
            return
        
        # 通知チャネルを確認
        channel = task.notification_channel
        if not channel:
            return
        
        # 通知を送信
        if channel == "slack":
            await self._send_slack_notification(db, task, execution)
        elif channel == "email":
            await self._send_email_notification(db, task, execution)
    
    async def _send_slack_notification(
        self,
        db: Session,
        task: Task,
        execution: Execution
    ):
        """Slackに通知を送信"""
        # Webhook URLを取得
        if task.notification_credential_id:
            cred = credential_manager.get_with_data(db, task.notification_credential_id)
        else:
            cred = credential_manager.get_default(db, "webhook", "slack")
        
        if not cred:
            logger.warning("Slack Webhook URLが設定されていません")
            return
        
        webhook_url = cred["data"].get("webhook_url")
        if not webhook_url:
            return
        
        # メッセージを作成
        status_emoji = "✅" if execution.status == "completed" else "❌"
        status_text = "成功" if execution.status == "completed" else "失敗"
        
        message = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{status_emoji} タスク実行 {status_text}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*タスク:*\n{task.name}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*ステータス:*\n{execution.status}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*開始時刻:*\n{execution.started_at.strftime('%Y-%m-%d %H:%M:%S') if execution.started_at else '-'}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*完了時刻:*\n{execution.completed_at.strftime('%Y-%m-%d %H:%M:%S') if execution.completed_at else '-'}"
                        }
                    ]
                }
            ]
        }
        
        # エラーメッセージがあれば追加
        if execution.error_message:
            message["blocks"].append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*エラー:*\n```{execution.error_message[:500]}```"
                }
            })
        
        # 送信
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=message, timeout=10)
                if response.status_code == 200:
                    logger.info(f"Slack通知を送信しました: task_id={task.id}")
                else:
                    logger.error(f"Slack通知エラー: {response.status_code}")
        except Exception as e:
            logger.error(f"Slack通知送信エラー: {e}")
    
    async def _send_email_notification(
        self,
        db: Session,
        task: Task,
        execution: Execution
    ):
        """メール通知を送信（未実装）"""
        # TODO: SMTP設定が必要
        logger.warning("メール通知は未実装です")
    
    async def send_test_notification(
        self,
        db: Session,
        channel: str,
        credential_id: Optional[int] = None
    ) -> dict:
        """テスト通知を送信"""
        if channel == "slack":
            if credential_id:
                cred = credential_manager.get_with_data(db, credential_id)
            else:
                cred = credential_manager.get_default(db, "webhook", "slack")
            
            if not cred:
                return {"success": False, "message": "Webhook URLが見つかりません"}
            
            webhook_url = cred["data"].get("webhook_url")
            if not webhook_url:
                return {"success": False, "message": "Webhook URLが設定されていません"}
            
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        webhook_url,
                        json={"text": "🔔 Workflow Dashboard: テスト通知"},
                        timeout=10
                    )
                    if response.status_code == 200:
                        return {"success": True, "message": "テスト通知を送信しました"}
                    else:
                        return {"success": False, "message": f"エラー: {response.status_code}"}
            except Exception as e:
                return {"success": False, "message": str(e)}
        
        return {"success": False, "message": "サポートされていないチャネルです"}


# シングルトンインスタンス
notification_service = NotificationService()







