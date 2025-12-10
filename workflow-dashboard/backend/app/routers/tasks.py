"""タスク管理 API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Task, Execution, TaskTrigger
from app.schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskWithCredentials, MessageResponse,
    TaskBatchUpdateRequest, TaskTriggerCreate, TaskTriggerUpdate, TaskTriggerResponse
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
    
    # タスクに関連するexecutionsを取得
    executions = db.query(Execution).filter(Execution.task_id == task_id).all()
    
    # 各executionのcurrent_step_idをNULLに設定（外部キー制約を回避）
    for execution in executions:
        if execution.current_step_id is not None:
            execution.current_step_id = None
    
    db.commit()
    
    # タスクを削除（cascadeでexecutionsとexecution_stepsも削除される）
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
        "execution_id": execution.id,
        "status": "pending"
    }


# ==================== バッチ更新API ====================

@router.post("/batch-update", response_model=MessageResponse)
async def batch_update_tasks(
    request: TaskBatchUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """複数タスクを一括更新（ドラッグ&ドロップ用）"""
    user_id = get_user_filter(current_user)
    
    for task_update in request.tasks:
        query = db.query(Task).filter(Task.id == task_update.id)
        if user_id:
            query = query.filter(Task.user_id == user_id)
        
        task = query.first()
        if task:
            if task_update.project_id is not None:
                task.project_id = task_update.project_id if task_update.project_id > 0 else None
            if task_update.role_group is not None:
                task.role_group = task_update.role_group
            if task_update.role_group_id is not None:
                task.role_group_id = task_update.role_group_id if task_update.role_group_id > 0 else None
            if task_update.order_index is not None:
                task.order_index = task_update.order_index
    
    db.commit()
    return {"message": f"{len(request.tasks)}件のタスクを更新しました"}


# ==================== トリガーAPI ====================

@router.get("/{task_id}/triggers", response_model=List[TaskTriggerResponse])
async def get_task_triggers(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクのトリガー一覧を取得"""
    # タスクの存在確認
    user_id = get_user_filter(current_user)
    task_query = db.query(Task).filter(Task.id == task_id)
    if user_id:
        task_query = task_query.filter(Task.user_id == user_id)
    
    task = task_query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    triggers = db.query(TaskTrigger).filter(TaskTrigger.task_id == task_id).all()
    return triggers


@router.post("/{task_id}/triggers", response_model=TaskTriggerResponse)
async def create_task_trigger(
    task_id: int,
    trigger: TaskTriggerCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクのトリガーを作成"""
    # タスクの存在確認
    user_id = get_user_filter(current_user)
    task_query = db.query(Task).filter(Task.id == task_id)
    if user_id:
        task_query = task_query.filter(Task.user_id == user_id)
    
    task = task_query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    trigger_data = trigger.model_dump()
    trigger_data["task_id"] = task_id
    
    db_trigger = TaskTrigger(**trigger_data)
    db.add(db_trigger)
    db.commit()
    db.refresh(db_trigger)
    return db_trigger


@router.put("/triggers/{trigger_id}", response_model=TaskTriggerResponse)
async def update_task_trigger(
    trigger_id: int,
    trigger_update: TaskTriggerUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """トリガーを更新"""
    trigger = db.query(TaskTrigger).filter(TaskTrigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="トリガーが見つかりません")
    
    # タスクの所有確認
    user_id = get_user_filter(current_user)
    if user_id:
        task = db.query(Task).filter(Task.id == trigger.task_id, Task.user_id == user_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    update_data = trigger_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trigger, key, value)
    
    db.commit()
    db.refresh(trigger)
    return trigger


@router.delete("/triggers/{trigger_id}", response_model=MessageResponse)
async def delete_task_trigger(
    trigger_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """トリガーを削除"""
    trigger = db.query(TaskTrigger).filter(TaskTrigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="トリガーが見つかりません")
    
    # タスクの所有確認
    user_id = get_user_filter(current_user)
    if user_id:
        task = db.query(Task).filter(Task.id == trigger.task_id, Task.user_id == user_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    db.delete(trigger)
    db.commit()
    return {"message": "トリガーを削除しました"}


# ==================== タスク個別チャットAPI ====================

from pydantic import BaseModel
from app.services.project_chat import project_chat_service


class TaskChatRequest(BaseModel):
    """タスクチャットリクエスト"""
    message: str
    chat_history: list = None


class TaskChatActionsRequest(BaseModel):
    """タスクアクション実行リクエスト"""
    actions: list


@router.post("/{task_id}/chat")
async def task_chat(
    task_id: int,
    request: TaskChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスク個別のAIチャット（ロジック理解・微調整）"""
    user_id = get_user_filter(current_user)
    task_query = db.query(Task).filter(Task.id == task_id)
    if user_id:
        task_query = task_query.filter(Task.user_id == user_id)
    
    task = task_query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    # チャットを実行（user_idを渡してAPIキー保存時に使用）
    result = await project_chat_service.task_chat(
        db,
        task_id,
        request.message,
        request.chat_history,
        user_id
    )
    
    return result


@router.post("/{task_id}/chat/execute-actions")
async def execute_task_chat_actions(
    task_id: int,
    request: TaskChatActionsRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクチャットで提案されたアクションを実行"""
    user_id = get_user_filter(current_user)
    task_query = db.query(Task).filter(Task.id == task_id)
    if user_id:
        task_query = task_query.filter(Task.user_id == user_id)
    
    task = task_query.first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    result = await project_chat_service.execute_task_actions(
        db,
        task_id,
        request.actions
    )
    
    return result



