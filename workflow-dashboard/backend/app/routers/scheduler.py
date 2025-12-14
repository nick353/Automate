"""スケジュール管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Task
from app.services.scheduler import scheduler_service
from app.schemas import MessageResponse

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


class ScheduleUpdate(BaseModel):
    schedule: Optional[str] = None


@router.get("/jobs")
def get_all_jobs():
    """全てのスケジュールジョブを取得"""
    return scheduler_service.get_all_jobs()


@router.get("/tasks/{task_id}/next-run")
def get_next_run(task_id: int, db: Session = Depends(get_db)):
    """タスクの次回実行時刻を取得"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    next_run = scheduler_service.get_next_run_time(task_id)
    
    return {
        "task_id": task_id,
        "schedule": task.schedule,
        "next_run": next_run.isoformat() if next_run else None
    }


@router.put("/tasks/{task_id}/schedule", response_model=MessageResponse)
def update_schedule(
    task_id: int,
    schedule_data: ScheduleUpdate,
    db: Session = Depends(get_db)
):
    """タスクのスケジュールを更新"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    # スケジュールを更新
    task.schedule = schedule_data.schedule
    db.commit()
    
    # スケジューラーを更新
    scheduler_service.update_task(task_id, schedule_data.schedule)
    
    if schedule_data.schedule:
        return {"message": f"スケジュールを設定しました: {schedule_data.schedule}"}
    else:
        return {"message": "スケジュールを解除しました"}


@router.post("/tasks/{task_id}/enable", response_model=MessageResponse)
def enable_schedule(task_id: int, db: Session = Depends(get_db)):
    """タスクのスケジュールを有効化"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    if not task.schedule:
        raise HTTPException(status_code=400, detail="スケジュールが設定されていません")
    
    success = scheduler_service.add_task(task_id, task.schedule)
    if not success:
        raise HTTPException(status_code=400, detail="スケジュール登録に失敗しました")
    
    return {"message": "スケジュールを有効化しました"}


@router.post("/tasks/{task_id}/disable", response_model=MessageResponse)
def disable_schedule(task_id: int, db: Session = Depends(get_db)):
    """タスクのスケジュールを無効化"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    scheduler_service.remove_task(task_id)
    
    return {"message": "スケジュールを無効化しました"}


@router.post("/reload", response_model=MessageResponse)
def reload_schedules():
    """全てのスケジュールを再読み込み"""
    scheduler_service._load_scheduled_tasks()
    return {"message": "スケジュールを再読み込みしました"}







