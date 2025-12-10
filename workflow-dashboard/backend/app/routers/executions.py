"""実行履歴 API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.database import get_db
from app.models import Execution, ExecutionStep
from app.schemas import ExecutionResponse, ExecutionWithTask, ExecutionWithSteps, MessageResponse

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("", response_model=List[ExecutionWithTask])
def get_executions(
    skip: int = 0,
    limit: int = 100,
    task_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """実行履歴一覧を取得"""
    query = db.query(Execution)
    
    if task_id:
        query = query.filter(Execution.task_id == task_id)
    
    if status:
        query = query.filter(Execution.status == status)
    
    executions = query.order_by(Execution.started_at.desc()).offset(skip).limit(limit).all()
    return executions


@router.get("/{execution_id}", response_model=ExecutionWithSteps)
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行詳細を取得"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行履歴が見つかりません")
    return execution


@router.get("/{execution_id}/logs")
def get_execution_logs(execution_id: int, db: Session = Depends(get_db)):
    """実行ログを取得"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行履歴が見つかりません")
    
    if not execution.log_file:
        return {"logs": []}
    
    log_path = Path(execution.log_file)
    if not log_path.exists():
        return {"logs": []}
    
    with open(log_path, "r", encoding="utf-8") as f:
        logs = f.readlines()
    
    return {"logs": logs}


@router.get("/{execution_id}/result/download")
def download_execution_result(execution_id: int, db: Session = Depends(get_db)):
    """実行結果をダウンロード"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行履歴が見つかりません")
    
    if not execution.result:
        raise HTTPException(status_code=404, detail="結果データがありません")
    
    # 結果をJSONファイルとして返す
    import json
    from tempfile import NamedTemporaryFile
    
    result_data = {
        "execution_id": execution.id,
        "task_id": execution.task_id,
        "status": execution.status,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
        "result": execution.result,
        "total_steps": execution.total_steps,
        "completed_steps": execution.completed_steps
    }
    
    with NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)
        temp_path = f.name
    
    return FileResponse(
        temp_path,
        media_type="application/json",
        filename=f"execution_{execution_id}_result.json"
    )


@router.delete("/{execution_id}", response_model=MessageResponse)
def delete_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行履歴を削除"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行履歴が見つかりません")
    
    # current_step_idをNULLに設定（外部キー制約を回避）
    if execution.current_step_id is not None:
        execution.current_step_id = None
        db.commit()
    
    # スクリーンショットファイルを削除
    screenshot_dir = Path("screenshots") / str(execution_id)
    if screenshot_dir.exists():
        import shutil
        shutil.rmtree(screenshot_dir)
    
    # executionを削除（cascadeでexecution_stepsも削除される）
    db.delete(execution)
    db.commit()
    return {"message": "実行履歴を削除しました"}


@router.get("/running/count")
def get_running_count(db: Session = Depends(get_db)):
    """実行中のタスク数を取得"""
    count = db.query(Execution).filter(
        Execution.status.in_(["running", "pending"])
    ).count()
    return {"count": count}





