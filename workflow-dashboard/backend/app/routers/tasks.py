"""タスク管理 API"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, Execution
from app.schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskWithCredentials, MessageResponse
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskResponse])
def get_tasks(
    skip: int = 0,
    limit: int = 100,
    is_active: bool = None,
    db: Session = Depends(get_db)
):
    """タスク一覧を取得"""
    query = db.query(Task)
    
    if is_active is not None:
        query = query.filter(Task.is_active == is_active)
    
    tasks = query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    return tasks


@router.post("", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """タスクを作成"""
    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/{task_id}", response_model=TaskWithCredentials)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """タスク詳細を取得"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    """タスクを更新"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """タスクを削除"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    db.delete(task)
    db.commit()
    return {"message": "タスクを削除しました"}


@router.post("/{task_id}/toggle", response_model=TaskResponse)
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    """タスクの有効/無効を切り替え"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    task.is_active = not task.is_active
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/run", response_model=MessageResponse)
async def run_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """タスクを手動実行"""
    from app.services.agent import run_task_with_live_view
    from datetime import datetime
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    # 実行レコードを作成
    execution = Execution(
        task_id=task_id,
        status="pending",
        triggered_by="manual",
        started_at=datetime.utcnow()
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # バックグラウンドで実行
    background_tasks.add_task(run_task_with_live_view, task_id, execution.id)
    
    return {
        "message": "タスクを開始しました",
        "status": str(execution.id)
    }

