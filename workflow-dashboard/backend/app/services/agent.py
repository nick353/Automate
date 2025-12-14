"""Browser Use エージェントサービス（ライブビュー対応）"""
import asyncio
import base64
import os
import httpx
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session
from playwright.async_api import async_playwright

from app.models import Task, Execution, ExecutionStep
from app.database import SessionLocal
from app.services.browser_controller import browser_controller, ExecutionState
from app.services.live_view_manager import live_view_manager
from app.services.credential_manager import credential_manager
from app.services.screencast import screencast_manager
from app.utils.logger import logger

SCREENSHOT_DIR = Path("screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


class LiveViewAgent:
    """ライブビュー対応のBrowser Useエージェント"""
    
    def __init__(
        self,
        task: Task,
        execution: Execution,
        db: Session
    ):
        self.task = task
        self.execution = execution
        self.db = db
        self.step_count = 0
        self.browser = None
        self.page = None  # ライブビュー用
        self.state: Optional[ExecutionState] = None
    
    async def run(self) -> dict:
        """タスクを実行（サーバー実行は無効化）"""
        # サーバー側のブラウザ実行を無効化
        logger.warning(f"サーバー側のブラウザ実行は無効化されています: task_id={self.task.id}")
        
        await live_view_manager.send_log(
            self.execution.id,
            "WARNING",
            "⚠️ サーバー側のブラウザ実行は無効化されています"
        )
        
        await live_view_manager.send_log(
            self.execution.id,
            "INFO",
            "GitHub Actionsで実行してください（GITHUB_ACTIONS_SETUP.md参照）"
        )
        
        await live_view_manager.send_execution_complete(
            self.execution.id,
            status="failed",
            error="サーバー実行は無効化されています。GitHub Actionsを使用してください。"
        )
        
        return {
            "success": False,
            "error": (
                "🚫 サーバー側のブラウザ実行は無効化されています\n\n"
                "🚀 **GitHub Actionsで実行してください**\n\n"
                "理由：\n"
                "- GitHub Actionsの方が安定して動作します\n"
                "- リソース制限がありません\n"
                "- クリーンな環境で毎回実行されます\n\n"
                "設定方法は GITHUB_ACTIONS_SETUP.md を参照してください。"
            ),
            "disabled_server_execution": True
        }


# --- スケジューラー用: 最低限のスタブを提供 ---
async def run_task_with_live_view(task_id: int, execution_id: int):
    """
    サーバー側実行を無効化したため、GitHub Actions経由で実行するように促すスタブ。
    スケジューラーからのImportErrorを防ぎ、実行を失敗ステータスで完了させる。
    """
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        execution = db.query(Execution).filter(Execution.id == execution_id).first()

        if not task or not execution:
            logger.warning(f"タスクまたは実行が見つかりません: task_id={task_id}, execution_id={execution_id}")
            return

        msg = (
            "サーバー側のブラウザ実行は無効化されています。\\n"
            "GitHub Actionsで実行してください。\\n"
            "手順: GITHUB_ACTIONS_SETUP.md を参照。"
        )

        execution.status = "failed"
        execution.error_message = msg
        execution.completed_at = datetime.utcnow()
        db.commit()

        await live_view_manager.send_log(execution.id, "WARNING", msg)
        await live_view_manager.send_execution_complete(
            execution.id,
            status="failed",
            error=msg
        )
        logger.warning(f"サーバー実行は無効化されています: task_id={task_id}, execution_id={execution_id}")

    except Exception as e:
        logger.error(f"run_task_with_live_view スタブでエラー: {e}")
    finally:
        db.close()
