"""
GitHub Actions Webhook エンドポイント

GitHub Actionsからの実行結果を受信し、
データベースの実行履歴を更新する。
"""

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from app.database import SessionLocal
from app.models import Execution
from app.services.live_view_manager import live_view_manager
from app.utils.logger import logger

router = APIRouter(prefix="/github-webhook", tags=["github-webhook"])


class GitHubWebhookPayload(BaseModel):
    """GitHub Actionsからの結果ペイロード"""
    execution_id: int
    task_id: int
    status: str  # success, failure
    result: Optional[Dict[str, Any]] = None
    run_id: Optional[int] = None
    run_url: Optional[str] = None


@router.post("/result")
async def receive_github_result(
    payload: GitHubWebhookPayload,
    request: Request,
    x_github_execution_id: Optional[str] = Header(None)
):
    """
    GitHub Actionsからの実行結果を受信
    
    このエンドポイントはGitHub Actionsワークフローの完了時に呼び出される。
    実行履歴を更新し、必要に応じて通知を送信する。
    """
    logger.info(
        f"GitHub webhook received: execution_id={payload.execution_id}, "
        f"status={payload.status}"
    )
    
    db = SessionLocal()
    try:
        # 実行履歴を取得
        execution = db.query(Execution).filter(
            Execution.id == payload.execution_id
        ).first()
        
        if not execution:
            logger.warning(f"Execution not found: {payload.execution_id}")
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # 結果を解析
        result_data = payload.result or {}
        success = result_data.get("success", False)
        result_text = result_data.get("result", "")
        error_text = result_data.get("error", "")
        steps_completed = result_data.get("steps_completed", 0)
        
        # 実行履歴を更新
        if success:
            execution.status = "completed"
            execution.result = result_text
        else:
            execution.status = "failed"
            execution.error_message = error_text or f"GitHub Actions: {payload.status}"
        
        execution.completed_at = datetime.utcnow()
        execution.total_steps = steps_completed
        execution.completed_steps = steps_completed
        
        # GitHub Actions 実行情報を結果に追加
        if payload.run_url:
            extra_info = f"\n\n[GitHub Actions 実行ログ]({payload.run_url})"
            if execution.result:
                execution.result += extra_info
            else:
                execution.result = extra_info
        
        db.commit()
        
        logger.info(
            f"Execution updated: id={payload.execution_id}, "
            f"status={execution.status}"
        )
        
        # WebSocketで完了通知（接続があれば）
        try:
            await live_view_manager.send_execution_complete(
                execution_id=payload.execution_id,
                status=execution.status,
                result=execution.result,
                error=execution.error_message
            )
        except Exception as e:
            logger.warning(f"WebSocket notification failed: {e}")
        
        return {
            "success": True,
            "message": "Result received and processed",
            "execution_id": payload.execution_id,
            "status": execution.status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GitHub webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/status/{execution_id}")
async def get_github_execution_status(execution_id: int):
    """
    GitHub Actions実行のステータスを取得
    
    フロントエンドからポーリングで呼び出される。
    """
    from app.services.github_actions import github_actions_service
    
    db = SessionLocal()
    try:
        execution = db.query(Execution).filter(
            Execution.id == execution_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        return {
            "execution_id": execution_id,
            "status": execution.status,
            "result": execution.result,
            "error": execution.error_message,
            "started_at": execution.started_at.isoformat() if execution.started_at else None,
            "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
            "total_steps": execution.total_steps,
            "completed_steps": execution.completed_steps
        }
        
    finally:
        db.close()


@router.get("/config")
async def get_github_config():
    """
    GitHub Actions設定状態を取得
    
    フロントエンドで設定状態を表示するために使用。
    """
    from app.services.github_actions import github_actions_service
    
    is_configured = github_actions_service.is_configured()
    
    return {
        "configured": is_configured,
        "repo_owner": github_actions_service.repo_owner if is_configured else None,
        "repo_name": github_actions_service.repo_name if is_configured else None,
        "message": "GitHub Actions is ready" if is_configured else "GitHub Actions is not configured"
    }


@router.get("/recent-runs")
async def get_recent_runs(limit: int = 10):
    """
    最近のGitHub Actions実行を取得
    """
    from app.services.github_actions import github_actions_service
    
    result = await github_actions_service.list_recent_runs(limit=limit)
    return result
