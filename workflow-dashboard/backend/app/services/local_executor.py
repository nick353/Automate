"""
ローカルエージェント経由の実行

登録済みタスクをローカルエージェント経由で実行するためのサービス。
試運転と同じインフラを使用して、ユーザーのPCでタスクを実行します。
"""

import asyncio
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Task, Execution, ExecutionStep
from app.services.live_view_manager import live_view_manager
from app.utils.logger import logger

# 試運転APIからconnected_agentsをインポート
# 注意: 循環インポートを避けるため、遅延インポートを使用


async def run_on_local_agent(task: Task, execution: Execution, db: Session) -> dict:
    """
    ローカルエージェント経由でタスクを実行
    
    試運転と同じ仕組みを使用しますが、結果をDBに保存します。
    """
    from app.routers.trial_run import connected_agents, trial_sessions, broadcast_to_watchers
    
    # 接続中のエージェントを確認
    if not connected_agents:
        error_msg = "ローカルエージェントが接続されていません"
        logger.error(error_msg)
        
        await live_view_manager.send_log(
            execution.id,
            "ERROR",
            error_msg
        )
        
        return {
            "success": False,
            "error": error_msg
        }
    
    # 最初に接続されたエージェントを使用
    agent_id = list(connected_agents.keys())[0]
    agent_ws = connected_agents[agent_id]
    
    # 実行状態を更新
    execution.status = "running"
    execution.started_at = datetime.now()
    db.commit()
    
    await live_view_manager.send_log(
        execution.id,
        "INFO",
        f"ローカルエージェント ({agent_id}) で実行開始"
    )
    
    # 実行IDをtrial_idとして使用
    trial_id = f"exec_{execution.id}"
    
    # セッションを作成
    trial_sessions[trial_id] = {
        "trial_id": trial_id,
        "execution_id": execution.id,
        "agent_id": agent_id,
        "task_prompt": task.task_prompt,
        "execution_type": task.execution_type or "desktop",
        "max_steps": task.max_steps or 20,
        "status": "running",
        "current_step": 0,
        "started_at": datetime.now().isoformat(),
        "screenshots": [],
        "logs": [],
        "result": None,
        "error": None
    }
    
    # 完了を待つためのイベント
    completion_event = asyncio.Event()
    result_holder = {"result": None}
    
    # 元のメッセージハンドラを保存
    original_on_message = None
    
    async def handle_execution_messages():
        """実行メッセージを処理"""
        nonlocal result_holder
        
        try:
            async for message in agent_ws:
                data = json.loads(message)
                msg_type = data.get("type")
                msg_trial_id = data.get("trial_id")
                
                # この実行に関係ないメッセージはスキップ
                if msg_trial_id != trial_id:
                    continue
                
                if msg_type == "screenshot":
                    # スクリーンショット更新
                    step = data.get("step", 0)
                    trial_sessions[trial_id]["current_step"] = step
                    
                    # ライブビューに転送
                    await live_view_manager.broadcast(
                        execution.id,
                        {
                            "type": "screenshot_update",
                            "data": {
                                "screenshot": data.get("data"),
                                "timestamp": datetime.now().isoformat()
                            }
                        }
                    )
                
                elif msg_type == "log":
                    # ログ更新
                    level = data.get("level", "INFO")
                    message_text = data.get("message", "")
                    
                    await live_view_manager.send_log(
                        execution.id,
                        level,
                        message_text
                    )
                
                elif msg_type == "step_update":
                    # ステップ更新
                    step = data.get("step", 0)
                    description = data.get("description", "")
                    status = data.get("status", "running")
                    
                    trial_sessions[trial_id]["current_step"] = step
                    
                    # ステップをDBに記録
                    db_step = ExecutionStep(
                        execution_id=execution.id,
                        step_number=step,
                        action_type="action",
                        description=description,
                        status=status,
                        started_at=datetime.now()
                    )
                    db.add(db_step)
                    db.commit()
                    
                    execution.total_steps = step
                    execution.current_step_id = db_step.id
                    db.commit()
                    
                    # ライブビューに通知
                    await live_view_manager.send_step_update(
                        execution_id=execution.id,
                        step_number=step,
                        action_type="action",
                        description=description,
                        status=status
                    )
                
                elif msg_type == "trial_completed":
                    # 実行完了
                    trial_sessions[trial_id]["status"] = "completed"
                    trial_sessions[trial_id]["result"] = data.get("result")
                    
                    result_holder["result"] = {
                        "success": True,
                        "result": data.get("result"),
                        "total_steps": trial_sessions[trial_id]["current_step"]
                    }
                    completion_event.set()
                    break
                
                elif msg_type == "trial_failed":
                    # 実行失敗
                    error = data.get("error")
                    trial_sessions[trial_id]["status"] = "failed"
                    trial_sessions[trial_id]["error"] = error
                    
                    result_holder["result"] = {
                        "success": False,
                        "error": error,
                        "total_steps": trial_sessions[trial_id]["current_step"]
                    }
                    completion_event.set()
                    break
                
                elif msg_type == "pong":
                    # ヘルスチェック応答
                    pass
                    
        except Exception as e:
            logger.error(f"メッセージ処理エラー: {e}")
            result_holder["result"] = {
                "success": False,
                "error": str(e)
            }
            completion_event.set()
    
    # ローカルエージェントは常にLux（デスクトップ自動化）を使用
    # Webタスクでもローカルエージェントならデスクトップモードで実行
    execution_type = "desktop"
    
    await live_view_manager.send_log(
        execution.id,
        "INFO",
        "ローカルエージェント（Lux）でデスクトップ操作を実行します"
    )
    
    # エージェントにタスクを送信
    try:
        await agent_ws.send(json.dumps({
            "type": "trial_execute",
            "trial_id": trial_id,
            "task_prompt": task.task_prompt,
            "execution_type": execution_type,
            "max_steps": task.max_steps or 20
        }))
        
        logger.info(f"ローカルエージェントにタスクを送信: execution_id={execution.id}")
        
    except Exception as e:
        error_msg = f"エージェントへの送信失敗: {str(e)}"
        logger.error(error_msg)
        
        # クリーンアップ
        if trial_id in trial_sessions:
            del trial_sessions[trial_id]
        
        return {
            "success": False,
            "error": error_msg
        }
    
    # メッセージハンドラを開始
    message_task = asyncio.create_task(handle_execution_messages())
    
    # タイムアウト付きで完了を待機
    timeout_seconds = (task.max_steps or 20) * 60  # 1ステップあたり最大1分
    
    try:
        await asyncio.wait_for(completion_event.wait(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning(f"実行タイムアウト: execution_id={execution.id}")
        result_holder["result"] = {
            "success": False,
            "error": f"タイムアウト ({timeout_seconds}秒)",
            "total_steps": trial_sessions.get(trial_id, {}).get("current_step", 0)
        }
    finally:
        # クリーンアップ
        message_task.cancel()
        try:
            await message_task
        except asyncio.CancelledError:
            pass
        
        if trial_id in trial_sessions:
            del trial_sessions[trial_id]
    
    result = result_holder.get("result", {"success": False, "error": "不明なエラー"})
    
    # 完了をライブビューに通知
    await live_view_manager.send_execution_complete(
        execution.id,
        status="completed" if result.get("success") else "failed",
        result=result.get("result"),
        error=result.get("error")
    )
    
    return result

