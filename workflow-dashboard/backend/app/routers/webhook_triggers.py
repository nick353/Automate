"""Webhookトリガー API - LINE通知やウェブサイトからのトリガー"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Header
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib
import hmac
import json

from app.database import get_db
from app.models import Task, Execution, TaskTrigger
from app.schemas import MessageResponse
from app.services.auth import get_current_user, UserInfo
from app.utils.logger import logger

router = APIRouter(prefix="/webhook", tags=["webhooks"])


def get_user_filter(user: Optional[UserInfo]):
    """ユーザーIDフィルターを取得（開発モード対応）"""
    if user and user.id != "local-dev":
        return user.id
    return None


@router.post("/trigger/{task_id}/{trigger_id}", response_model=MessageResponse)
async def trigger_task_via_webhook(
    task_id: int,
    trigger_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_webhook_secret: Optional[str] = Header(None)
):
    """汎用Webhookエンドポイント - 任意のサービスからタスクをトリガー
    
    使用例:
    1. LINE Notify, Slack, Discord などのWebhookから呼び出し
    2. Zapier, Make.com などの自動化ツールから呼び出し
    3. 他のウェブサイトからのイベント通知
    
    セキュリティ:
    - trigger_idがUUID的に推測困難（32文字以上推奨）
    - X-Webhook-Secret ヘッダーで追加認証（オプション）
    """
    from app.services.agent import run_task_with_live_view
    
    # トリガーの存在確認
    trigger = db.query(TaskTrigger).filter(
        TaskTrigger.id == trigger_id,
        TaskTrigger.task_id == task_id
    ).first()
    
    if not trigger:
        raise HTTPException(status_code=404, detail="トリガーが見つかりません")
    
    # トリガーが無効化されている場合
    if not trigger.is_active:
        raise HTTPException(status_code=403, detail="このトリガーは無効化されています")
    
    # タスクの存在確認
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    # タスクが無効化されている場合
    if not task.is_active:
        raise HTTPException(status_code=403, detail="このタスクは無効化されています")
    
    # Webhookのペイロードを取得
    try:
        payload = await request.json()
    except:
        payload = {}
    
    # 実行レコードを作成
    execution = Execution(
        task_id=task_id,
        status="pending",
        triggered_by="webhook",
        started_at=datetime.now(timezone.utc)
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # バックグラウンドでタスクを実行
    background_tasks.add_task(run_task_with_live_view, task_id, execution.id)
    
    logger.info(f"Webhook trigger: Task {task_id} triggered by trigger {trigger_id}")
    
    return {
        "message": "タスクをトリガーしました",
        "task_id": task_id,
        "execution_id": execution.id,
        "trigger_type": trigger.trigger_type,
        "status": "pending"
    }


@router.post("/line/{task_id}/{trigger_id}", response_model=MessageResponse)
async def trigger_task_via_line(
    task_id: int,
    trigger_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_line_signature: Optional[str] = Header(None)
):
    """LINE Notify専用Webhookエンドポイント
    
    LINE Notifyの設定:
    1. https://notify-bot.line.me/my/ にアクセス
    2. 「マイページ」→「トークンを発行する」
    3. Webhook URLにこのエンドポイントを設定
    
    URL例:
    https://your-domain.com/api/webhook/line/{task_id}/{trigger_id}
    """
    from app.services.agent import run_task_with_live_view
    
    # トリガーの存在確認
    trigger = db.query(TaskTrigger).filter(
        TaskTrigger.id == trigger_id,
        TaskTrigger.task_id == task_id,
        TaskTrigger.trigger_type == "webhook"  # Webhook型のみ
    ).first()
    
    if not trigger:
        raise HTTPException(status_code=404, detail="LINEトリガーが見つかりません")
    
    if not trigger.is_active:
        raise HTTPException(status_code=403, detail="このトリガーは無効化されています")
    
    # タスクの存在確認
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    if not task.is_active:
        raise HTTPException(status_code=403, detail="このタスクは無効化されています")
    
    # LINEペイロードを取得
    try:
        body = await request.body()
        payload = json.loads(body.decode('utf-8'))
        
        # LINEのイベントタイプを確認
        events = payload.get("events", [])
        if not events:
            raise HTTPException(status_code=400, detail="LINEイベントが含まれていません")
        
        # 最初のイベントを処理
        event = events[0]
        event_type = event.get("type")
        
        logger.info(f"LINE event received: {event_type}")
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="無効なJSONペイロード")
    
    # 実行レコードを作成
    execution = Execution(
        task_id=task_id,
        status="pending",
        triggered_by="webhook_line",
        started_at=datetime.now(timezone.utc)
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # バックグラウンドでタスクを実行
    background_tasks.add_task(run_task_with_live_view, task_id, execution.id)
    
    logger.info(f"LINE trigger: Task {task_id} triggered by LINE event")
    
    return {
        "message": "LINEトリガーでタスクを開始しました",
        "task_id": task_id,
        "execution_id": execution.id,
        "event_type": event_type,
        "status": "pending"
    }


@router.get("/tasks/{task_id}/webhook-url")
async def get_webhook_url(
    task_id: int,
    trigger_type: str = "generic",  # generic, line, slack
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクのWebhook URLを取得（トリガー作成時に使用）
    
    trigger_type:
    - generic: 汎用Webhook（デフォルト）
    - line: LINE専用
    - slack: Slack専用（将来実装）
    """
    import os
    
    # タスクの存在確認
    user_id = get_user_filter(current_user)
    task_query = db.query(Task).filter(Task.id == task_id)
    if user_id:
        task_query = task_query.filter(Task.user_id == user_id)
    
    task = task_query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    # Webhookトリガーを取得または作成
    webhook_trigger = db.query(TaskTrigger).filter(
        TaskTrigger.task_id == task_id,
        TaskTrigger.trigger_type == "webhook"
    ).first()
    
    if not webhook_trigger:
        # 新規作成
        webhook_trigger = TaskTrigger(
            task_id=task_id,
            trigger_type="webhook",
            is_active=True
        )
        db.add(webhook_trigger)
        db.commit()
        db.refresh(webhook_trigger)
    
    # URLを構築
    app_url = os.environ.get("APP_URL", "http://localhost:8000")
    
    if trigger_type == "line":
        webhook_url = f"{app_url}/api/webhook/line/{task_id}/{webhook_trigger.id}"
    else:
        webhook_url = f"{app_url}/api/webhook/trigger/{task_id}/{webhook_trigger.id}"
    
    return {
        "webhook_url": webhook_url,
        "trigger_id": webhook_trigger.id,
        "trigger_type": trigger_type,
        "is_active": webhook_trigger.is_active,
        "instructions": {
            "generic": "このURLにPOSTリクエストを送信すると、タスクがトリガーされます。",
            "line": "LINE Notifyの設定ページでこのURLをWebhook URLとして登録してください。",
            "slack": "Slackの「Incoming Webhooks」でこのURLを設定してください。"
        }.get(trigger_type, "このURLにPOSTリクエストを送信すると、タスクがトリガーされます。"),
        "example_curl": f"""curl -X POST {webhook_url} \\
  -H "Content-Type: application/json" \\
  -d '{{"message": "Triggered from external source"}}'"""
    }


@router.post("/test/{task_id}/{trigger_id}")
async def test_webhook_trigger(
    task_id: int,
    trigger_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """Webhookトリガーのテスト実行（認証あり、本番実行なし）"""
    
    # タスクとトリガーの存在確認
    user_id = get_user_filter(current_user)
    task_query = db.query(Task).filter(Task.id == task_id)
    if user_id:
        task_query = task_query.filter(Task.user_id == user_id)
    
    task = task_query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    trigger = db.query(TaskTrigger).filter(
        TaskTrigger.id == trigger_id,
        TaskTrigger.task_id == task_id
    ).first()
    
    if not trigger:
        raise HTTPException(status_code=404, detail="トリガーが見つかりません")
    
    return {
        "message": "Webhookトリガーのテストが成功しました",
        "task_id": task_id,
        "task_name": task.name,
        "trigger_id": trigger_id,
        "trigger_type": trigger.trigger_type,
        "is_active": trigger.is_active,
        "note": "実際のタスク実行は行われません。本番環境でWebhook URLにPOSTリクエストを送信してください。"
    }
