"""ライブビュー API"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.database import get_db
from app.models import Execution, ExecutionStep
from app.services.browser_controller import browser_controller
from app.services.live_view_manager import live_view_manager

router = APIRouter(tags=["live_view"])


@router.get("/executions/{execution_id}/live")
async def get_live_view_data(execution_id: int, db: Session = Depends(get_db)):
    """ライブビューの現在のデータを取得"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    # ステップ一覧を取得
    steps = db.query(ExecutionStep).filter(
        ExecutionStep.execution_id == execution_id
    ).order_by(ExecutionStep.step_number).all()
    
    # 制御状態を取得
    state = browser_controller.get_state(execution_id)
    
    return {
        "execution": {
            "id": execution.id,
            "task_id": execution.task_id,
            "status": execution.status,
            "started_at": execution.started_at.isoformat() if execution.started_at else None,
            "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
            "total_steps": execution.total_steps or 0,
            "completed_steps": execution.completed_steps or 0,
            "result": execution.result,
            "error_message": execution.error_message
        },
        "steps": [
            {
                "id": s.id,
                "step_number": s.step_number,
                "action_type": s.action_type,
                "description": s.description,
                "status": s.status,
                "duration_ms": s.duration_ms,
                "error_message": s.error_message,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None
            }
            for s in steps
        ],
        "control": {
            "is_paused": state.is_paused if state else False,
            "is_stopping": state.is_stopping if state else False,
            "is_running": state is not None and not state.is_stopping
        },
        "screenshot": live_view_manager.get_cached_screenshot(execution_id),
        "logs": live_view_manager.get_cached_logs(execution_id)
    }


@router.get("/executions/{execution_id}/steps")
async def get_execution_steps(execution_id: int, db: Session = Depends(get_db)):
    """実行のステップ一覧を取得"""
    steps = db.query(ExecutionStep).filter(
        ExecutionStep.execution_id == execution_id
    ).order_by(ExecutionStep.step_number).all()
    
    return [
        {
            "id": s.id,
            "step_number": s.step_number,
            "action_type": s.action_type,
            "description": s.description,
            "status": s.status,
            "screenshot_path": s.screenshot_path,
            "duration_ms": s.duration_ms,
            "error_message": s.error_message,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None
        }
        for s in steps
    ]


@router.get("/executions/{execution_id}/screenshot")
async def get_latest_screenshot(execution_id: int):
    """最新のスクリーンショットを取得"""
    screenshot = live_view_manager.get_cached_screenshot(execution_id)
    if not screenshot:
        raise HTTPException(status_code=404, detail="スクリーンショットがありません")
    
    return {"screenshot": screenshot}


@router.get("/executions/{execution_id}/screenshots/{step_number}")
async def get_step_screenshot(execution_id: int, step_number: int):
    """特定ステップのスクリーンショットを取得"""
    screenshot_path = Path(f"screenshots/{execution_id}/{step_number}.png")
    
    if not screenshot_path.exists():
        raise HTTPException(status_code=404, detail="スクリーンショットが見つかりません")
    
    return FileResponse(screenshot_path, media_type="image/png")


@router.post("/executions/{execution_id}/pause")
async def pause_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行を一時停止"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    if execution.status != "running":
        raise HTTPException(status_code=400, detail="実行中のタスクのみ一時停止できます")
    
    success = await browser_controller.pause(execution_id)
    if not success:
        raise HTTPException(status_code=400, detail="一時停止に失敗しました")
    
    execution.status = "paused"
    db.commit()
    
    return {"message": "一時停止しました", "status": "paused"}


@router.post("/executions/{execution_id}/resume")
async def resume_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行を再開"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    if execution.status != "paused":
        raise HTTPException(status_code=400, detail="一時停止中のタスクのみ再開できます")
    
    success = await browser_controller.resume(execution_id)
    if not success:
        raise HTTPException(status_code=400, detail="再開に失敗しました")
    
    execution.status = "running"
    db.commit()
    
    return {"message": "再開しました", "status": "running"}


@router.post("/executions/{execution_id}/stop")
async def stop_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行を停止"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    if execution.status not in ["running", "paused"]:
        raise HTTPException(status_code=400, detail="実行中または一時停止中のタスクのみ停止できます")
    
    success = await browser_controller.stop(execution_id)
    if not success:
        raise HTTPException(status_code=400, detail="停止に失敗しました")
    
    return {"message": "停止をリクエストしました", "status": "stopping"}



