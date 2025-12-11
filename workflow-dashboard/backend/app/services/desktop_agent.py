"""Lux (OAGI) デスクトップエージェントサービス（ライブビュー対応）"""
import asyncio
import base64
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Any

from sqlalchemy.orm import Session

from app.models import Task, Execution, ExecutionStep
from app.database import SessionLocal
from app.services.browser_controller import browser_controller, ExecutionState
from app.services.live_view_manager import live_view_manager
from app.services.credential_manager import credential_manager
from app.utils.logger import logger

SCREENSHOT_DIR = Path("screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


class DesktopAgent:
    """Lux (OAGI) を使用したデスクトップ自動化エージェント"""
    
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
        self.state: Optional[ExecutionState] = None
        self.agent = None
    
    async def run(self) -> dict:
        """タスクを実行（Luxを使用してデスクトップ操作）"""
        try:
            # 実行状態を登録
            self.state = browser_controller.register_execution(self.execution.id)
            
            # 制御状態の変更時にWebSocket配信
            browser_controller.add_callback(
                self.execution.id,
                lambda event: asyncio.create_task(
                    live_view_manager.send_control_update(self.execution.id, event)
                )
            )
            
            # OAGI APIキーを取得
            oagi_credential = None
            if self.task.lux_credential_id:
                oagi_credential = credential_manager.get_with_data(self.db, self.task.lux_credential_id)
            
            if not oagi_credential:
                # デフォルトのOAGI認証情報を探す
                oagi_credential = credential_manager.get_default(self.db, "api_key", "oagi")
            
            if not oagi_credential:
                raise ValueError("OAGI (Lux) APIキーが設定されていません。認証情報を追加してください。")
            
            api_key = oagi_credential["data"]["api_key"]
            
            # 環境変数に設定（OAGI SDKが使用）
            os.environ["OAGI_API_KEY"] = api_key
            
            # 実行開始を通知
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                f"デスクトップタスク開始: {self.task.name}"
            )
            
            # OAGI SDKをインポート（遅延インポート）
            try:
                from oagi import AsyncDefaultAgent, AsyncPyautoguiActionHandler, AsyncScreenshotMaker
            except ImportError as e:
                logger.error(f"OAGI SDK のインポートに失敗: {e}")
                raise ValueError("OAGI SDK がインストールされていません。pip install oagi を実行してください。")
            
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                "Lux エージェントを初期化中..."
            )
            
            # 最大ステップ数
            max_steps_limit = getattr(self.task, "max_steps", 20) or 20
            
            # カスタムアクションハンドラーでステップを追跡
            class TrackedActionHandler(AsyncPyautoguiActionHandler):
                def __init__(self, parent_agent: 'DesktopAgent'):
                    super().__init__()
                    self.parent = parent_agent
                
                async def execute(self, action: Any) -> Any:
                    """アクション実行をトラッキング"""
                    # 一時停止チェック
                    should_continue = await browser_controller.wait_if_paused(self.parent.execution.id)
                    if not should_continue:
                        raise InterruptedError("実行が停止されました")
                    
                    # ステップ上限チェック
                    if self.parent.step_count >= max_steps_limit:
                        raise InterruptedError(f"ステップ上限({max_steps_limit})に達しました")
                    
                    self.parent.step_count += 1
                    step_start = datetime.now()
                    
                    # アクション情報を取得
                    action_type = getattr(action, 'type', 'action') if hasattr(action, 'type') else 'action'
                    action_desc = str(action)[:200] if action else "デスクトップ操作"
                    
                    # ステップ開始を記録
                    step = await self.parent._create_step(
                        step_number=self.parent.step_count,
                        action_type=action_type,
                        description=action_desc,
                        status="running"
                    )
                    
                    await live_view_manager.send_log(
                        self.parent.execution.id,
                        "INFO",
                        f"ステップ {self.parent.step_count}: {action_desc[:100]}"
                    )
                    
                    try:
                        # 元のアクションを実行
                        result = await super().execute(action)
                        
                        duration_ms = int((datetime.now() - step_start).total_seconds() * 1000)
                        
                        # スクリーンショットを取得
                        screenshot_base64 = await self.parent._take_screenshot(self.parent.step_count)
                        
                        # ステップを完了に更新
                        await self.parent._update_step(
                            step,
                            status="completed",
                            screenshot_path=f"screenshots/{self.parent.execution.id}/{self.parent.step_count}.png" if screenshot_base64 else None,
                            duration_ms=duration_ms
                        )
                        
                        # ライブビューに通知
                        await live_view_manager.send_step_update(
                            execution_id=self.parent.execution.id,
                            step_number=self.parent.step_count,
                            action_type=action_type,
                            description=action_desc,
                            status="completed",
                            screenshot_base64=screenshot_base64,
                            duration_ms=duration_ms
                        )
                        
                        return result
                        
                    except Exception as e:
                        duration_ms = int((datetime.now() - step_start).total_seconds() * 1000)
                        await self.parent._update_step(
                            step,
                            status="failed",
                            error_message=str(e),
                            duration_ms=duration_ms
                        )
                        raise
            
            # カスタムスクリーンショットメーカー（ライブビュー用）
            class TrackedScreenshotMaker(AsyncScreenshotMaker):
                def __init__(self, parent_agent: 'DesktopAgent'):
                    super().__init__()
                    self.parent = parent_agent
                    self.last_screenshot: Optional[bytes] = None
                
                async def capture(self) -> bytes:
                    """スクリーンショットを取得してキャッシュ"""
                    screenshot_bytes = await super().capture()
                    self.last_screenshot = screenshot_bytes
                    return screenshot_bytes
            
            # エージェントを作成
            screenshot_maker = TrackedScreenshotMaker(self)
            action_handler = TrackedActionHandler(self)
            
            self.agent = AsyncDefaultAgent(max_steps=max_steps_limit)
            
            # 定期的にスクリーンショットを送信（ライブビュー用）
            screenshot_task = None
            
            async def periodic_screenshot():
                """定期的にスクリーンショットを送信（疑似動画）"""
                while True:
                    try:
                        await asyncio.sleep(1.0)
                        if screenshot_maker.last_screenshot:
                            screenshot_base64 = base64.b64encode(screenshot_maker.last_screenshot).decode("utf-8")
                            await live_view_manager.broadcast(
                                self.execution.id,
                                {
                                    "type": "screenshot_update",
                                    "data": {
                                        "screenshot": screenshot_base64,
                                        "timestamp": datetime.now().isoformat()
                                    }
                                }
                            )
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.warning(f"定期スクリーンショット送信エラー: {e}")
                        await asyncio.sleep(2)
            
            screenshot_task = asyncio.create_task(periodic_screenshot())
            
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                "Lux エージェント実行開始"
            )
            
            # タスクプロンプトを構築
            task_prompt = self.task.task_prompt
            
            # サイト認証情報があれば追加
            if self.task.site_credential_id:
                site_cred = credential_manager.get_with_data(self.db, self.task.site_credential_id)
                if site_cred and site_cred["data"]:
                    cred_data = site_cred["data"]
                    if "url" in cred_data:
                        task_prompt += f"\n\nログイン先URL: {cred_data['url']}"
                    if "username" in cred_data:
                        task_prompt += f"\nユーザー名: {cred_data['username']}"
                    if "password" in cred_data:
                        task_prompt += f"\nパスワード: {cred_data['password']}"
            
            try:
                # エージェントを実行
                result = await self.agent.execute(
                    task_prompt,
                    action_handler=action_handler,
                    image_provider=screenshot_maker
                )
                
                # スクリーンショット送信タスクを停止
                if screenshot_task:
                    screenshot_task.cancel()
                    try:
                        await screenshot_task
                    except asyncio.CancelledError:
                        pass
                
                # 最終スクリーンショット
                final_screenshot = await self._take_screenshot(self.step_count + 1)
                if final_screenshot:
                    await live_view_manager.send_step_update(
                        execution_id=self.execution.id,
                        step_number=self.step_count + 1,
                        action_type="final",
                        description="タスク完了",
                        status="completed",
                        screenshot_base64=final_screenshot
                    )
                
                # 実行完了を通知
                await live_view_manager.send_log(
                    self.execution.id,
                    "INFO",
                    "デスクトップタスク完了"
                )
                
                await live_view_manager.send_execution_complete(
                    self.execution.id,
                    status="completed",
                    result=str(result) if result else None
                )
                
                return {
                    "success": True,
                    "result": str(result) if result else None,
                    "total_steps": self.step_count
                }
                
            finally:
                # スクリーンショット送信タスクを確実に停止
                if screenshot_task and not screenshot_task.done():
                    screenshot_task.cancel()
                    try:
                        await screenshot_task
                    except asyncio.CancelledError:
                        pass
            
        except InterruptedError as e:
            await live_view_manager.send_log(
                self.execution.id,
                "WARNING",
                "タスクが停止されました"
            )
            await live_view_manager.send_execution_complete(
                self.execution.id,
                status="stopped"
            )
            return {
                "success": False,
                "error": str(e),
                "stopped": True,
                "total_steps": self.step_count
            }
        except Exception as e:
            logger.error(f"デスクトップエージェント実行エラー: {e}")
            await live_view_manager.send_log(
                self.execution.id,
                "ERROR",
                f"エラー発生: {str(e)}"
            )
            await live_view_manager.send_execution_complete(
                self.execution.id,
                status="failed",
                error=str(e)
            )
            return {
                "success": False,
                "error": str(e),
                "total_steps": self.step_count
            }
        finally:
            browser_controller.cleanup(self.execution.id)
    
    async def _create_step(
        self,
        step_number: int,
        action_type: str,
        description: str,
        status: str
    ) -> ExecutionStep:
        """ステップをDBに作成"""
        step = ExecutionStep(
            execution_id=self.execution.id,
            step_number=step_number,
            action_type=action_type,
            description=description,
            status=status,
            started_at=datetime.now()
        )
        self.db.add(step)
        self.db.commit()
        self.db.refresh(step)
        
        # 実行の現在ステップを更新
        self.execution.current_step_id = step.id
        self.execution.total_steps = step_number
        self.db.commit()
        
        # ライブビューに通知
        await live_view_manager.send_step_update(
            execution_id=self.execution.id,
            step_number=step_number,
            action_type=action_type,
            description=description,
            status=status
        )
        
        return step
    
    async def _update_step(
        self,
        step: ExecutionStep,
        status: str,
        screenshot_path: Optional[str] = None,
        duration_ms: Optional[int] = None,
        description: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """ステップを更新"""
        step.status = status
        step.completed_at = datetime.now()
        if screenshot_path:
            step.screenshot_path = screenshot_path
        if duration_ms is not None:
            step.duration_ms = duration_ms
        if description:
            step.description = description
        if error_message:
            step.error_message = error_message
        
        self.db.commit()
        
        # 完了ステップ数を更新
        if status == "completed":
            self.execution.completed_steps = (self.execution.completed_steps or 0) + 1
            self.db.commit()
    
    async def _take_screenshot(self, step_number: int) -> Optional[str]:
        """スクリーンショットを取得してBase64で返す（PyAutoGUI使用）"""
        try:
            import pyautogui
            from PIL import Image
            import io
            
            # 画面全体のスクリーンショットを取得
            screenshot = pyautogui.screenshot()
            
            # バイトに変換
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            screenshot_bytes = buffer.getvalue()
            
            # ファイルに保存
            screenshot_dir = SCREENSHOT_DIR / str(self.execution.id)
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            screenshot_path = screenshot_dir / f"{step_number}.png"
            
            with open(screenshot_path, "wb") as f:
                f.write(screenshot_bytes)
            
            # 実行の最新スクリーンショットパスを更新
            self.execution.last_screenshot_path = str(screenshot_path)
            self.db.commit()
            
            # Base64エンコード
            return base64.b64encode(screenshot_bytes).decode("utf-8")
            
        except Exception as e:
            logger.warning(f"スクリーンショット取得失敗: {e}")
            await live_view_manager.send_log(
                self.execution.id,
                "WARNING",
                f"スクリーンショット取得失敗: {str(e)}"
            )
            return None


async def run_desktop_task_with_live_view(task_id: int, execution_id: int):
    """ライブビュー対応でデスクトップタスクを実行（バックグラウンドタスク用）"""
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        execution = db.query(Execution).filter(Execution.id == execution_id).first()
        
        if not task or not execution:
            logger.error(f"タスクまたは実行が見つかりません: task_id={task_id}, execution_id={execution_id}")
            return
        
        # 実行状態を更新
        execution.status = "running"
        execution.started_at = datetime.now()
        db.commit()
        
        # エージェントを実行
        agent = DesktopAgent(
            task=task,
            execution=execution,
            db=db
        )
        
        result = await agent.run()
        
        # 結果を保存
        if result.get("stopped"):
            execution.status = "stopped"
        elif result.get("success"):
            execution.status = "completed"
            execution.result = result.get("result")
        else:
            execution.status = "failed"
            execution.error_message = result.get("error")
        
        execution.completed_at = datetime.now()
        db.commit()
        
        logger.info(f"デスクトップタスク実行完了: task_id={task_id}, status={execution.status}")
        
    except Exception as e:
        logger.error(f"デスクトップタスク実行エラー: {e}")
        if execution:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.completed_at = datetime.now()
            db.commit()
    finally:
        # LiveViewManagerのクリーンアップは少し遅延
        await asyncio.sleep(2)
        live_view_manager.cleanup(execution_id)
        db.close()





