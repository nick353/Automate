"""システム設定 API"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.services.notifier import notification_service

router = APIRouter(prefix="/settings", tags=["settings"])


class NotificationTestRequest(BaseModel):
    channel: str  # slack, email
    credential_id: Optional[int] = None


@router.get("")
def get_settings():
    """システム設定を取得"""
    return {
        "version": "1.0.0",
        "features": {
            "video_analysis": True,
            "live_view": True,
            "scheduling": True,
            "notifications": True
        }
    }


@router.post("/notifications/test")
async def test_notification(
    request: NotificationTestRequest,
    db: Session = Depends(get_db)
):
    """通知をテスト"""
    result = await notification_service.send_test_notification(
        db,
        request.channel,
        request.credential_id
    )
    return result


@router.get("/health")
def health_check():
    """詳細なヘルスチェック"""
    from app.services.scheduler import scheduler_service
    
    return {
        "status": "healthy",
        "scheduler": {
            "running": scheduler_service._started,
            "jobs_count": len(scheduler_service.get_all_jobs())
        }
    }



