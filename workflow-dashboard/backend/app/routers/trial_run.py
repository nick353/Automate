"""
試運転（トライアルラン）API

タスクを登録する前に、実際にLuxで動作確認するための機能。
ユーザーのローカルPCに接続して、リアルタイムで動作を確認できます。
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from app.utils.logger import logger

router = APIRouter(prefix="/trial-run", tags=["trial-run"])


class TrialRunRequest(BaseModel):
    """試運転リクエスト"""
    task_prompt: str
    execution_type: str = "desktop"  # web, desktop, hybrid
    max_steps: int = 10  # 試運転は少なめに
    agent_id: Optional[str] = None  # 接続済みのエージェントID


class TrialRunStatus(BaseModel):
    """試運転ステータス"""
    trial_id: str
    status: str  # waiting, running, completed, failed, stopped
    agent_id: Optional[str] = None
    current_step: int = 0
    max_steps: int = 10
    message: str = ""


# 接続中のローカルエージェント
connected_agents: Dict[str, WebSocket] = {}

# 試運転セッション
trial_sessions: Dict[str, dict] = {}

# 試運転を監視しているクライアント
trial_watchers: Dict[str, Set[WebSocket]] = {}


@router.get("/agents")
async def list_connected_agents():
    """接続中のローカルエージェント一覧"""
    agents = []
    for agent_id, ws in connected_agents.items():
        agents.append({
            "agent_id": agent_id,
            "connected": True,
            "status": "ready"
        })
    return {"agents": agents, "count": len(agents)}


@router.post("/start", response_model=TrialRunStatus)
async def start_trial_run(request: TrialRunRequest):
    """試運転を開始"""
    
    # 接続中のエージェントを確認
    if not connected_agents:
        raise HTTPException(
            status_code=400,
            detail="ローカルエージェントが接続されていません。PCでエージェントを起動してください。"
        )
    
    # エージェントを選択
    agent_id = request.agent_id
    if not agent_id:
        # 最初に接続されたエージェントを使用
        agent_id = list(connected_agents.keys())[0]
    
    if agent_id not in connected_agents:
        raise HTTPException(
            status_code=400,
            detail=f"エージェント {agent_id} は接続されていません"
        )
    
    # 試運転セッションを作成
    trial_id = str(uuid.uuid4())[:8]
    trial_sessions[trial_id] = {
        "trial_id": trial_id,
        "agent_id": agent_id,
        "task_prompt": request.task_prompt,
        "execution_type": request.execution_type,
        "max_steps": request.max_steps,
        "status": "running",
        "current_step": 0,
        "started_at": datetime.now().isoformat(),
        "screenshots": [],
        "logs": [],
        "result": None,
        "error": None
    }
    
    trial_watchers[trial_id] = set()
    
    # エージェントにタスクを送信
    agent_ws = connected_agents[agent_id]
    try:
        await agent_ws.send_json({
            "type": "trial_execute",
            "trial_id": trial_id,
            "task_prompt": request.task_prompt,
            "execution_type": request.execution_type,
            "max_steps": request.max_steps
        })
        
        logger.info(f"試運転開始: trial_id={trial_id}, agent={agent_id}")
        
        return TrialRunStatus(
            trial_id=trial_id,
            status="running",
            agent_id=agent_id,
            max_steps=request.max_steps,
            message="試運転を開始しました"
        )
        
    except Exception as e:
        del trial_sessions[trial_id]
        raise HTTPException(status_code=500, detail=f"エージェントへの送信失敗: {str(e)}")


@router.post("/{trial_id}/stop")
async def stop_trial_run(trial_id: str):
    """試運転を停止"""
    if trial_id not in trial_sessions:
        raise HTTPException(status_code=404, detail="試運転が見つかりません")
    
    session = trial_sessions[trial_id]
    agent_id = session["agent_id"]
    
    if agent_id in connected_agents:
        try:
            await connected_agents[agent_id].send_json({
                "type": "trial_stop",
                "trial_id": trial_id
            })
        except Exception as e:
            logger.warning(f"停止指示の送信失敗: {e}")
    
    session["status"] = "stopped"
    session["message"] = "ユーザーにより停止されました"
    
    # 監視者に通知
    await broadcast_to_watchers(trial_id, {
        "type": "trial_stopped",
        "trial_id": trial_id,
        "message": "試運転が停止されました"
    })
    
    return {"message": "試運転を停止しました"}


@router.get("/{trial_id}/status", response_model=TrialRunStatus)
async def get_trial_status(trial_id: str):
    """試運転のステータスを取得"""
    if trial_id not in trial_sessions:
        raise HTTPException(status_code=404, detail="試運転が見つかりません")
    
    session = trial_sessions[trial_id]
    return TrialRunStatus(
        trial_id=trial_id,
        status=session["status"],
        agent_id=session["agent_id"],
        current_step=session["current_step"],
        max_steps=session["max_steps"],
        message=session.get("message", "")
    )


@router.get("/{trial_id}/screenshots")
async def get_trial_screenshots(trial_id: str):
    """試運転のスクリーンショット履歴を取得"""
    if trial_id not in trial_sessions:
        raise HTTPException(status_code=404, detail="試運転が見つかりません")
    
    session = trial_sessions[trial_id]
    return {
        "trial_id": trial_id,
        "screenshots": session.get("screenshots", []),
        "count": len(session.get("screenshots", []))
    }


@router.get("/{trial_id}/result")
async def get_trial_result(trial_id: str):
    """試運転の結果を取得"""
    if trial_id not in trial_sessions:
        raise HTTPException(status_code=404, detail="試運転が見つかりません")
    
    session = trial_sessions[trial_id]
    return {
        "trial_id": trial_id,
        "status": session["status"],
        "result": session.get("result"),
        "error": session.get("error"),
        "logs": session.get("logs", []),
        "total_steps": session["current_step"]
    }


async def broadcast_to_watchers(trial_id: str, message: dict):
    """試運転を監視しているクライアントにブロードキャスト"""
    if trial_id not in trial_watchers:
        return
    
    dead_connections = set()
    for ws in trial_watchers[trial_id]:
        try:
            await ws.send_json(message)
        except Exception:
            dead_connections.add(ws)
    
    # 切断されたコネクションを削除
    trial_watchers[trial_id] -= dead_connections


# =============================================================================
# WebSocket エンドポイント
# =============================================================================

@router.websocket("/agent/{agent_id}")
async def agent_websocket(websocket: WebSocket, agent_id: str):
    """ローカルエージェントからの接続を受け付け"""
    await websocket.accept()
    
    # 接続を登録
    connected_agents[agent_id] = websocket
    logger.info(f"ローカルエージェント接続: {agent_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "screenshot":
                # スクリーンショット更新
                trial_id = data.get("trial_id")
                if trial_id and trial_id in trial_sessions:
                    screenshot_data = {
                        "step": data.get("step", 0),
                        "image": data.get("data"),
                        "timestamp": datetime.now().isoformat()
                    }
                    trial_sessions[trial_id]["screenshots"].append(screenshot_data)
                    trial_sessions[trial_id]["current_step"] = data.get("step", 0)
                    
                    # 監視者に転送
                    await broadcast_to_watchers(trial_id, {
                        "type": "screenshot_update",
                        "trial_id": trial_id,
                        "step": screenshot_data["step"],
                        "image": screenshot_data["image"],
                        "timestamp": screenshot_data["timestamp"]
                    })
            
            elif msg_type == "log":
                # ログ更新
                trial_id = data.get("trial_id")
                if trial_id and trial_id in trial_sessions:
                    log_entry = {
                        "level": data.get("level", "INFO"),
                        "message": data.get("message", ""),
                        "timestamp": datetime.now().isoformat()
                    }
                    trial_sessions[trial_id]["logs"].append(log_entry)
                    
                    await broadcast_to_watchers(trial_id, {
                        "type": "log_update",
                        "trial_id": trial_id,
                        **log_entry
                    })
            
            elif msg_type == "step_update":
                # ステップ更新
                trial_id = data.get("trial_id")
                if trial_id and trial_id in trial_sessions:
                    trial_sessions[trial_id]["current_step"] = data.get("step", 0)
                    trial_sessions[trial_id]["message"] = data.get("description", "")
                    
                    await broadcast_to_watchers(trial_id, {
                        "type": "step_update",
                        "trial_id": trial_id,
                        "step": data.get("step"),
                        "description": data.get("description"),
                        "status": data.get("status", "running")
                    })
            
            elif msg_type == "trial_completed":
                # 試運転完了
                trial_id = data.get("trial_id")
                if trial_id and trial_id in trial_sessions:
                    trial_sessions[trial_id]["status"] = "completed"
                    trial_sessions[trial_id]["result"] = data.get("result")
                    trial_sessions[trial_id]["message"] = "試運転が完了しました"
                    
                    await broadcast_to_watchers(trial_id, {
                        "type": "trial_completed",
                        "trial_id": trial_id,
                        "result": data.get("result"),
                        "total_steps": trial_sessions[trial_id]["current_step"]
                    })
            
            elif msg_type == "trial_failed":
                # 試運転失敗
                trial_id = data.get("trial_id")
                if trial_id and trial_id in trial_sessions:
                    trial_sessions[trial_id]["status"] = "failed"
                    trial_sessions[trial_id]["error"] = data.get("error")
                    trial_sessions[trial_id]["message"] = f"エラー: {data.get('error')}"
                    
                    await broadcast_to_watchers(trial_id, {
                        "type": "trial_failed",
                        "trial_id": trial_id,
                        "error": data.get("error")
                    })
            
            elif msg_type == "pong":
                # ヘルスチェック応答
                pass
                
    except WebSocketDisconnect:
        logger.info(f"ローカルエージェント切断: {agent_id}")
    except Exception as e:
        logger.error(f"エージェントWebSocketエラー: {e}")
    finally:
        # 接続を削除
        if agent_id in connected_agents:
            del connected_agents[agent_id]


@router.websocket("/watch/{trial_id}")
async def watch_trial(websocket: WebSocket, trial_id: str):
    """試運転をリアルタイムで監視"""
    if trial_id not in trial_sessions:
        await websocket.close(code=4004, reason="Trial not found")
        return
    
    await websocket.accept()
    
    # 監視者として登録
    if trial_id not in trial_watchers:
        trial_watchers[trial_id] = set()
    trial_watchers[trial_id].add(websocket)
    
    # 現在の状態を送信
    session = trial_sessions[trial_id]
    await websocket.send_json({
        "type": "initial_state",
        "trial_id": trial_id,
        "status": session["status"],
        "current_step": session["current_step"],
        "max_steps": session["max_steps"],
        "screenshots": session.get("screenshots", [])[-5:],  # 最新5枚
        "logs": session.get("logs", [])[-20:]  # 最新20件
    })
    
    try:
        while True:
            # クライアントからのメッセージを待機（キープアライブ）
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"監視WebSocketエラー: {e}")
    finally:
        if trial_id in trial_watchers:
            trial_watchers[trial_id].discard(websocket)

