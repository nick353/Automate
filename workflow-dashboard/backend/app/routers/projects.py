"""プロジェクト管理 API"""
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Project, Task, RoleGroup
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, MessageResponse,
    ProjectWithTasks, ProjectBoardData, TaskResponse,
    RoleGroupCreate, RoleGroupUpdate, RoleGroupResponse
)
from app.services.auth import get_current_user, UserInfo

router = APIRouter(prefix="/projects", tags=["projects"])


def get_user_filter(user: Optional[UserInfo]):
    if user and user.id != "local-dev":
        return user.id
    return None


@router.get("", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクト一覧を取得"""
    query = db.query(Project)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    
    projects = query.order_by(Project.updated_at.desc()).offset(skip).limit(limit).all()
    return projects


@router.post("", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトを作成"""
    project_data = project.model_dump()
    
    if current_user and current_user.id != "local-dev":
        project_data["user_id"] = current_user.id
    
    db_project = Project(**project_data)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクト詳細を取得"""
    query = db.query(Project).filter(Project.id == project_id)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    
    project = query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトを更新"""
    query = db.query(Project).filter(Project.id == project_id)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    
    project = query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    update_data = project_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトを削除（含まれるタスクも削除）"""
    query = db.query(Project).filter(Project.id == project_id)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    
    project = query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    db.delete(project)
    db.commit()
    return {"message": "プロジェクトを削除しました"}


# ==================== カンバンボード用API ====================

@router.get("/board/data", response_model=ProjectBoardData)
async def get_board_data(
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """カンバンボード用のデータを一括取得"""
    user_id = get_user_filter(current_user)
    
    # プロジェクトを取得（タスクと役割グループを含む）
    project_query = db.query(Project).options(
        joinedload(Project.tasks),
        joinedload(Project.role_groups)
    )
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    projects = project_query.order_by(Project.created_at.desc()).all()
    
    # 未割り当てタスク（プロジェクトIDがnull）
    unassigned_query = db.query(Task).filter(Task.project_id == None)
    if user_id:
        unassigned_query = unassigned_query.filter(Task.user_id == user_id)
    unassigned_tasks = unassigned_query.order_by(Task.order_index, Task.created_at.desc()).all()
    
    # レスポンス作成
    project_data = []
    for project in projects:
        sorted_tasks = sorted(project.tasks, key=lambda t: (t.order_index, t.id))
        sorted_groups = sorted(project.role_groups, key=lambda g: (g.order_index, g.id))
        project_data.append({
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "color": project.color or "#6366f1",
            "icon": project.icon or "folder",
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "tasks": sorted_tasks,
            "role_groups": sorted_groups
        })
    
    return {
        "projects": project_data,
        "unassigned_tasks": unassigned_tasks
    }


@router.get("/{project_id}/with-tasks", response_model=ProjectWithTasks)
async def get_project_with_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトとそのタスク、役割グループを取得"""
    query = db.query(Project).options(
        joinedload(Project.tasks),
        joinedload(Project.role_groups)
    ).filter(Project.id == project_id)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    
    project = query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    sorted_tasks = sorted(project.tasks, key=lambda t: (t.order_index, t.id))
    sorted_groups = sorted(project.role_groups, key=lambda g: (g.order_index, g.id))
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "color": project.color or "#6366f1",
        "icon": project.icon or "folder",
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "tasks": sorted_tasks,
        "role_groups": sorted_groups
    }


# ==================== 役割グループAPI ====================

@router.post("/{project_id}/role-groups", response_model=RoleGroupResponse)
async def create_role_group(
    project_id: int,
    role_group: RoleGroupCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """役割グループを作成"""
    # プロジェクトの存在確認
    project_query = db.query(Project).filter(Project.id == project_id)
    user_id = get_user_filter(current_user)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # 最大order_indexを取得
    max_order = db.query(RoleGroup).filter(
        RoleGroup.project_id == project_id
    ).count()
    
    group_data = role_group.model_dump()
    group_data["project_id"] = project_id
    group_data["order_index"] = max_order
    if user_id:
        group_data["user_id"] = user_id
    
    db_group = RoleGroup(**group_data)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@router.get("/{project_id}/role-groups", response_model=List[RoleGroupResponse])
async def get_role_groups(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトの役割グループ一覧を取得"""
    user_id = get_user_filter(current_user)
    
    query = db.query(RoleGroup).filter(RoleGroup.project_id == project_id)
    if user_id:
        query = query.filter(RoleGroup.user_id == user_id)
    
    groups = query.order_by(RoleGroup.order_index).all()
    return groups


@router.put("/role-groups/{group_id}", response_model=RoleGroupResponse)
async def update_role_group(
    group_id: int,
    group_update: RoleGroupUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """役割グループを更新"""
    query = db.query(RoleGroup).filter(RoleGroup.id == group_id)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(RoleGroup.user_id == user_id)
    
    group = query.first()
    if not group:
        raise HTTPException(status_code=404, detail="役割グループが見つかりません")
    
    update_data = group_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(group, key, value)
    
    db.commit()
    db.refresh(group)
    return group


@router.delete("/role-groups/{group_id}", response_model=MessageResponse)
async def delete_role_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """役割グループを削除"""
    query = db.query(RoleGroup).filter(RoleGroup.id == group_id)
    
    user_id = get_user_filter(current_user)
    if user_id:
        query = query.filter(RoleGroup.user_id == user_id)
    
    group = query.first()
    if not group:
        raise HTTPException(status_code=404, detail="役割グループが見つかりません")
    
    # グループに属するタスクのrole_group_idをnullに更新
    db.query(Task).filter(Task.role_group_id == group_id).update(
        {"role_group_id": None},
        synchronize_session=False
    )
    
    db.delete(group)
    db.commit()
    return {"message": "役割グループを削除しました"}


# ==================== プロジェクトチャットAPI ====================

from pydantic import BaseModel
from app.services.project_chat import project_chat_service


class ProjectChatRequest(BaseModel):
    """プロジェクトチャットリクエスト"""
    message: str
    chat_history: Optional[List[dict]] = None
    model: Optional[str] = None  # AIモデル選択


class ProjectChatActionsRequest(BaseModel):
    """アクション実行リクエスト"""
    actions: List[dict]


@router.post("/{project_id}/chat")
async def chat_with_project(
    project_id: int,
    request: ProjectChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトのAIチャット（全体管理）"""
    # プロジェクトの存在確認
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # チャットを実行（user_idを渡してAPIキー保存時に使用）
    result = await project_chat_service.chat(
        db,
        project_id,
        request.message,
        request.chat_history,
        user_id,
        request.model  # AIモデル選択
    )
    
    return result


@router.post("/{project_id}/chat/execute-actions")
async def execute_chat_actions(
    project_id: int,
    request: ProjectChatActionsRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """AIが提案したアクションを実行"""
    # プロジェクトの存在確認
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # アクションを実行
    result = await project_chat_service.execute_actions(
        db,
        project_id,
        request.actions,
        user_id
    )
    
    return result


@router.get("/{project_id}/workflow-explanation")
async def get_workflow_explanation(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクトのワークフロー説明を取得"""
    # プロジェクトの存在確認
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # ワークフロー説明を取得
    result = await project_chat_service.get_workflow_explanation(db, project_id)
    
    return result


# ==================== ウィザードチャットAPI ====================

class WizardChatRequest(BaseModel):
    """ウィザードチャットリクエスト"""
    message: str
    chat_history: Optional[List[dict]] = None
    video_analysis: Optional[dict] = None
    web_research: Optional[Any] = None  # list または dict を許容
    model: Optional[str] = None  # AIモデル選択


class WebSearchRequest(BaseModel):
    """Webリサーチリクエスト"""
    query: str
    num_results: int = 5


@router.post("/{project_id}/wizard-chat")
async def wizard_chat(
    project_id: int,
    request: WizardChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """空プロジェクト用ウィザードチャット（ワークフロー構築支援）"""
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    result = await project_chat_service.wizard_chat_for_new_project(
        db,
        project_id,
        request.message,
        request.chat_history,
        request.video_analysis,
        request.web_research,
        user_id,
        request.model  # AIモデル選択
    )
    
    return result


@router.post("/{project_id}/web-search")
async def web_search(
    project_id: int,
    request: WebSearchRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """Webリサーチを実行"""
    result = await project_chat_service.web_search(db, request.query, request.num_results)
    return result


@router.post("/{project_id}/analyze-video")
async def analyze_video_for_project(
    project_id: int,
    file: UploadFile = File(...),
    context: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクト用動画分析"""
    import uuid
    import aiofiles
    from pathlib import Path
    
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # ファイル形式チェック
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="サポートされていないファイル形式です")
    
    # ファイルを保存
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    file_path = upload_dir / f"{file_id}{file_ext}"
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # 動画を分析
    result = await project_chat_service.analyze_video_for_project(
        db,
        project_id,
        str(file_path),
        context
    )
    
    # ファイルを削除
    try:
        file_path.unlink()
    except:
        pass
    
    return result


@router.post("/{project_id}/analyze-file")
async def analyze_file_for_project(
    project_id: int,
    file: UploadFile = File(...),
    context: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """プロジェクト用汎用ファイル分析（簡易メタ情報+テキスト抜粋）"""
    import uuid
    import aiofiles
    from pathlib import Path
    
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    file_path = upload_dir / f"{file_id}{file_ext}"
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    result = await project_chat_service.analyze_file_for_project(
        db,
        project_id,
        str(file_path),
        file.filename,
        context
    )
    
    try:
        file_path.unlink()
    except Exception:
        pass
    
    return result


# ==================== タスク検証・テストAPI ====================

class CheckCredentialsRequest(BaseModel):
    """認証情報チェックリクエスト"""
    task_prompt: str
    execution_location: str = "server"


class ReviewTaskPromptRequest(BaseModel):
    """task_promptレビューリクエスト"""
    task_prompt: str
    task_name: str


class ValidateAndCreateTaskRequest(BaseModel):
    """検証付きタスク作成リクエスト"""
    task_data: dict
    skip_review: bool = False
    auto_run_test: bool = False


@router.post("/{project_id}/check-credentials")
async def check_credentials(
    project_id: int,
    request: CheckCredentialsRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスク実行に必要な認証情報をチェック"""
    result = project_chat_service.check_required_credentials(
        db,
        request.task_prompt,
        request.execution_location
    )
    return result


@router.post("/{project_id}/review-task-prompt")
async def review_task_prompt(
    project_id: int,
    request: ReviewTaskPromptRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """task_promptの品質をAIでレビュー"""
    result = await project_chat_service.review_task_prompt(
        db,
        request.task_prompt,
        request.task_name
    )
    return result


@router.post("/{project_id}/validate-and-create-task")
async def validate_and_create_task(
    project_id: int,
    request: ValidateAndCreateTaskRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タスクを検証してから作成（オプションでテスト実行）"""
    from app.services.agent import run_task_with_live_view
    from app.models import Execution
    from datetime import datetime
    
    user_id = get_user_filter(current_user)
    task_data = request.task_data
    
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    validation_results = {
        "credential_check": None,
        "review": None,
        "task_created": False,
        "test_execution": None
    }
    
    task_prompt = task_data.get("task_prompt", "")
    task_name = task_data.get("name", "")
    execution_location = task_data.get("execution_location", "server")
    
    # 1. 認証情報チェック
    cred_check = project_chat_service.check_required_credentials(
        db, task_prompt, execution_location
    )
    validation_results["credential_check"] = cred_check
    
    if not cred_check["is_ready"]:
        return {
            "success": False,
            "error": "必要な認証情報が不足しています",
            "validation": validation_results
        }
    
    # 2. AIレビュー（スキップしない場合）
    if not request.skip_review:
        review = await project_chat_service.review_task_prompt(db, task_prompt, task_name)
        validation_results["review"] = review
        
        if review.get("reviewed") and review.get("score", 10) < 5:
            return {
                "success": False,
                "error": "タスク指示の品質が低いため、改善が必要です",
                "validation": validation_results,
                "suggestions": review.get("suggestions", []),
                "improved_prompt": review.get("improved_prompt")
            }
    
    # 3. タスク作成
    try:
        task = Task(
            project_id=project_id,
            user_id=user_id,
            name=task_name,
            description=task_data.get("description"),
            task_prompt=task_prompt,
            schedule=task_data.get("schedule"),
            role_group=task_data.get("role_group", "General"),
            execution_location=execution_location,
            is_active=True
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        validation_results["task_created"] = True
    except Exception as e:
        return {
            "success": False,
            "error": f"タスク作成に失敗: {str(e)}",
            "validation": validation_results
        }
    
    # 4. テスト実行（オプション）
    if request.auto_run_test:
        try:
            execution = Execution(
                task_id=task.id,
                status="pending",
                triggered_by="test",
                started_at=datetime.utcnow()
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            
            # バックグラウンドで実行
            background_tasks.add_task(run_task_with_live_view, task.id, execution.id)
            
            validation_results["test_execution"] = {
                "execution_id": execution.id,
                "status": "started"
            }
        except Exception as e:
            validation_results["test_execution"] = {
                "error": str(e)
            }
    
    return {
        "success": True,
        "task": {
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "task_prompt": task.task_prompt,
            "schedule": task.schedule,
            "execution_location": task.execution_location
        },
        # 直近のテスト実行ID（auto_run_test=true のとき）
        "execution_id": validation_results.get("test_execution", {}).get("execution_id"),
        "validation": validation_results
    }


class AnalyzeErrorRequest(BaseModel):
    """エラー分析リクエスト"""
    task_id: int
    execution_id: int
    error_message: str
    logs: List[str] = []


@router.post("/{project_id}/analyze-error")
async def analyze_execution_error(
    project_id: int,
    request: AnalyzeErrorRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """実行エラーを分析して改善案を提案"""
    user_id = get_user_filter(current_user)
    project_query = db.query(Project).filter(Project.id == project_id)
    if user_id:
        project_query = project_query.filter(Project.user_id == user_id)
    
    project = project_query.first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    result = await project_chat_service.analyze_execution_error(
        db,
        project_id,
        request.task_id,
        request.execution_id,
        request.error_message,
        request.logs
    )
    return result
