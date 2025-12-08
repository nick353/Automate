"""タスク管理 API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, Execution
from app.schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskWithCredentials, MessageResponse
)
from app.services.auth import get_current_user, UserInfo

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_user_filter(user: Optional[UserInfo]):
    """ユーザーIDフィルターを取得（開発モード対応）"""
    if user and user.id != "local-dev":
        return user.id
    return None  # 開発モードではフィルタリングなし


@router.get("", response_model=List[TaskResponse])
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    is_active: bool = None,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスク一覧を取得（ユーザーに紐づくタスクのみ）"""
    query = db.query(Task)
    
    # ユーザーIDでフィルタリング
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    if is_active is not None:
        query = query.filter(Task.is_active == is_active)
    
    tasks = query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    return tasks


@router.post("", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクを作成（ユーザーIDを保存）"""
    task_data = task.model_dump()
    
    # ユーザーIDを追加
    if current_user and current_user.id != "local-dev":
        task_data["user_id"] = current_user.id
    
    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/{task_id}", response_model=TaskWithCredentials)
async def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスク詳細を取得"""
    query = db.query(Task).filter(Task.id == task_id)
    
    # ユーザーIDでフィルタリング
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    task = query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクを更新"""
    query = db.query(Task).filter(Task.id == task_id)
    
    # ユーザーIDでフィルタリング
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    task = query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクを削除"""
    query = db.query(Task).filter(Task.id == task_id)
    
    # ユーザーIDでフィルタリング
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    task = query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    db.delete(task)
    db.commit()
    return {"message": "タスクを削除しました"}


@router.post("/{task_id}/toggle", response_model=TaskResponse)
async def toggle_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクの有効/無効を切り替え"""
    query = db.query(Task).filter(Task.id == task_id)
    
    # ユーザーIDでフィルタリング
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    task = query.first()
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
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクを手動実行"""
    from app.services.agent import run_task_with_live_view
    from datetime import datetime
    
    query = db.query(Task).filter(Task.id == task_id)
    
    # ユーザーIDでフィルタリング
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    task = query.first()
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



