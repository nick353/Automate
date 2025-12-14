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
    
    async def _create_step(
        self,
            browser_use_key = os.environ.get("BROWSER_USE_API_KEY")
            if not browser_use_key:
                browser_use_cred = credential_manager.get_default(self.db, "api_key", "browser_use")
                if browser_use_cred:
                    browser_use_key = browser_use_cred["data"].get("api_key")
            if browser_use_key:
                os.environ["BROWSER_USE_API_KEY"] = browser_use_key
            
            # ブラウザを起動
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                "ブラウザを起動中..."
            )
            
            # ブラウザ設定を作成（利用可能な場合のみ）
            browser_config = None
            if browser_config_cls:
                browser_config = browser_config_cls(
                    headless=True,
                    disable_security=True,
                    extra_chromium_args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-software-rasterizer"
                    ]
                )
            
            # サイト認証情報があれば追加のコンテキストを設定
            task_prompt = self.task.task_prompt
            if self.task.site_credential_id:
                site_cred = credential_manager.get_with_data(self.db, self.task.site_credential_id)
                if site_cred and site_cred["data"]:
                    cred_data = site_cred["data"]
                    # 認証情報をプロンプトに追加（安全に）
                    if "url" in cred_data:
                        task_prompt += f"\n\nログイン先URL: {cred_data['url']}"
                    if "username" in cred_data:
                        task_prompt += f"\nユーザー名: {cred_data['username']}"
                    if "password" in cred_data:
                        task_prompt += f"\nパスワード: {cred_data['password']}"
            
            # LLMを設定
            if use_openai:
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(
                    model="gpt-4o",  # Browser UseはビジョンモデルのGPT-4oを推奨
                    api_key=api_key
                )
            else:
                from langchain_anthropic import ChatAnthropic
                llm = ChatAnthropic(
                    model="claude-sonnet-4-5-20250929",
                    api_key=api_key
                )
            
            # エージェントを作成
            if browser_config:
                agent = Agent(
                    task=task_prompt,
                    llm=llm,
                    browser=browser_config
                )
            else:
                agent = Agent(
                    task=task_prompt,
                    llm=llm
                )
            
            # ステップ追跡用の変数
            screencast_registered_ref = {"value": False}
            current_step_ref = {"step": None, "start_time": None}
            # 無限ループ防止の上限（タスクにmax_stepsがあれば使用）
            max_steps_limit = getattr(self.task, "max_steps", 20) or 20
            
            async def _get_page_context():
                """ページのタイトルとURLを取得（失敗してもNoneで返す）"""
                title = ""
                url = ""
                try:
                    page = self.page
                    if page:
                        try:
                            title = await page.title()
                        except Exception:
                            title = ""
                        try:
                            url = page.url
                        except Exception:
                            url = ""
                except Exception:
                    pass
                return title, url

            async def on_step_start_callback(agent_instance):
                """ステップ開始時のコールバック"""
                # 一時停止チェック
                should_continue = await browser_controller.wait_if_paused(self.execution.id)
                if not should_continue:
                    raise InterruptedError("実行が停止されました")
                
                # 上限チェック（過剰ステップで止まらないようにする）
                if self.step_count >= max_steps_limit:
                    raise InterruptedError(f"ステップ上限({max_steps_limit})に達しました")

                self.step_count += 1
                current_step_ref["start_time"] = datetime.now()
                
                # ページ情報
                title, url = await _get_page_context()
                # より具体的なステップ内容を記録（タイトル/URL/ステップ番号）
                if title or url:
                    step_desc = f"Step {self.step_count} 開始: {title} {url}".strip()
                else:
                    step_desc = f"Step {self.step_count} 開始: ブラウザ操作開始"

                # ステップ開始を記録
                step = await self._create_step(
                    step_number=self.step_count,
                    action_type="browser_action",
                    description=step_desc,
                    status="running"
                )
                current_step_ref["step"] = step
                
                await live_view_manager.send_log(
                    self.execution.id,
                    "INFO",
                    f"ステップ {self.step_count} 開始"
                )
            
            async def on_step_end_callback(agent_instance):
                """ステップ終了時のコールバック"""
                step = current_step_ref["step"]
                if not step:
                    return
                
                start_time = current_step_ref["start_time"]
                if not start_time:
                    return
                
                duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                
                # スクリーンショットを取得（常に取得してライブビューに送る）
                screenshot_base64 = await self._take_screenshot(self.step_count)

                # ページ情報を付与（できる範囲で）
                description = None
                try:
                    title, url = await _get_page_context()
                    if title or url:
                        description = f"{title} {url}".strip()
                except Exception:
                    description = None
                
                # ステップを完了に更新
                await self._update_step(
                    step,
                    status="completed",
                    screenshot_path=f"screenshots/{self.execution.id}/{self.step_count}.png" if screenshot_base64 else None,
                    duration_ms=duration_ms,
                    description=description
                )
                
                # ライブビューに通知
                await live_view_manager.send_step_update(
                    execution_id=self.execution.id,
                    step_number=self.step_count,
                    action_type="action",
                    description=description or "完了",
                    status="completed",
                    screenshot_base64=screenshot_base64,
                    duration_ms=duration_ms
                )
                
                # クリア
                current_step_ref["step"] = None
                current_step_ref["start_time"] = None
            
            # stepメソッドもフック（フォールバック用）
            original_step = agent.step if hasattr(agent, 'step') else None
            
            # stepメソッドをフック（フォールバック用）
            # 注意: on_step_start/on_step_endコールバックが主な方法だが、
            # 念のためstepメソッドもフックしておく
            if hasattr(agent, 'step'):
                original_step = agent.step
                
                async def step_with_tracking(self_agent, step_info=None):
                    """ステップ実行をトラッキング（フォールバック）"""
                    if current_step_ref["step"] is None:
                        await on_step_start_callback(self_agent)
                    
                    try:
                        # 元のメソッドを呼び出す
                        result = await original_step(step_info)
                        
                        await on_step_end_callback(self_agent)
                        return result
                    except Exception as e:
                        step = current_step_ref["step"]
                        if step:
                            duration_ms = int((datetime.now() - current_step_ref["start_time"]).total_seconds() * 1000) if current_step_ref["start_time"] else 0
                            await self._update_step(
                                step,
                                status="failed",
                                error_message=str(e),
                                duration_ms=duration_ms
                            )
                        raise
                
                # メソッドを置き換える
                import types
                agent.step = types.MethodType(step_with_tracking, agent)
            
            # エージェントを実行
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                "エージェント実行開始"
            )
            
            # ページ取得とスクリーンキャスト登録
            screencast_registered_ref["value"] = False
            screenshot_task = None

            async def ensure_page(retries: int = 5, delay: float = 0.5):
                for _ in range(retries):
                    if self.page:
                        return self.page
                    if hasattr(self.browser, "contexts") and self.browser.contexts:
                        try:
                            pages = await self.browser.contexts[0].pages()
                            if pages:
                                self.page = pages[0]
                                return self.page
                        except Exception:
                            pass
                    await asyncio.sleep(delay)
                return None

            try:
                if hasattr(agent, 'browser') and agent.browser:
                    self.browser = agent.browser
                    page = await ensure_page()
                    if page:
                        try:
                            screencast_manager.register_page(self.execution.id, page)
                            screencast_registered_ref["value"] = True
                            await live_view_manager.send_log(
                                self.execution.id,
                                "INFO",
                                "ライブビュー準備完了（CDP Screencast有効）"
                            )
                        except Exception as e:
                            logger.warning(f"スクリーンキャスト登録失敗（継続）: {e}")
            except Exception as e:
                logger.warning(f"ページ取得失敗（継続）: {e}")
            
            # スクリーンショットを定期送信（CDPの有無にかかわらず）
            if self.page:
                async def periodic_screenshot():
                    """定期的にスクリーンショットを送信（疑似動画）"""
                    while True:
                        try:
                            await asyncio.sleep(1.0)  # 1秒ごとに更新
                            screenshot_base64 = await self._take_screenshot(0)  # ステップ番号0は「最新」を意味する
                            if screenshot_base64:
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
                            await asyncio.sleep(2)  # エラー時は少し待機
                
                screenshot_task = asyncio.create_task(periodic_screenshot())
            
            # 実行開始時に初期ステップを作成（ステップが記録されない場合に備える）
            if self.step_count == 0:
                initial_step = await self._create_step(
                    step_number=1,
                    action_type="task_start",
                    description="タスク実行開始",
                    status="running"
                )

            # Browser UseのAgent.run()はコールバック引数を受け付けないため、max_stepsのみを渡す
            # ステップ追跡は別の方法で行う必要がある
            result = await agent.run(
                max_steps=max_steps_limit
            )

            # ステップが記録されなかった場合、初期ステップを完了にする
            if self.step_count == 0:
                if 'initial_step' in locals():
                    await self._update_step(
                        initial_step,
                        status="completed",
                        description="タスク実行完了"
                    )
                    await live_view_manager.send_step_update(
                        execution_id=self.execution.id,
                        step_number=1,
                        action_type="task_complete",
                        description="タスク実行完了",
                        status="completed"
                    )
            
            # スクリーンショット送信タスクを停止
            if screenshot_task:
                screenshot_task.cancel()
                try:
                    await screenshot_task
                except asyncio.CancelledError:
                    pass
            
            # 最終スクリーンショット（CDP screencastが無効な場合のみ）
            if not screencast_registered_ref["value"]:
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
                "タスク完了"
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
            logger.error(f"エージェント実行エラー: {e}")
            # 代表的なエラーに対するヒントを付与
            error_hint = None
            msg = str(e)
            if "Missing X server" in msg or "DISPLAY" in msg or "headless" in msg:
                error_hint = "サーバーでブラウザを起動できません。ヘッドレス起動が必要です（headless=Trueを指定済みか確認）。"
            if "BrowserType.launch" in msg or "Target page" in msg:
                error_hint = (error_hint or "") + " Playwrightの依存パッケージ不足や権限不足の可能性があります。"
            if "Browser' object has no attribute 'contexts'" in msg:
                error_hint = "Browser Use/Playwrightのバージョン不整合の可能性があります。`pip install -U browser-use playwright` を試してください。"

            await live_view_manager.send_log(
                self.execution.id,
                "ERROR",
                f"エラー発生: {str(e)}"
            )
            await live_view_manager.send_execution_complete(
                self.execution.id,
                status="failed",
                error=str(e) + (f"\nヒント: {error_hint}" if error_hint else "")
            )
            return {
                "success": False,
                "error": str(e) + (f"\nヒント: {error_hint}" if error_hint else ""),
                "total_steps": self.step_count
            }
        finally:
            # スクリーンキャストのクリーンアップ
            screencast_manager.unregister_page(self.execution.id)
            
            # ブラウザのクリーンアップ
            if self.browser:
                try:
                    await self.browser.close()
                except Exception:
                    pass
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
        """スクリーンショットを取得してBase64で返す"""
        try:
            if not self.browser:
                return None

            # 既に保持しているページを優先し、なければ先頭ページを取得
            page = self.page
            if not page:
                pages = await self.browser.contexts[0].pages() if self.browser.contexts else []
                if not pages:
                    return None
                page = pages[0]
                self.page = page

            screenshot_bytes = await page.screenshot(type="png")
            
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


async def run_api_only_task(task: Task, execution: Execution, db: Session, mark_completed: bool = True):
    """ブラウザ不要のAPI専用タスク実行（Drive監視の簡易実装）
    
    - 01_Artworks / 02_Videos を監視し、新規・更新ファイルを検知
    - 状態は 03_Processing/state.json に保存
    - Agent2 への通知はプレースホルダー（ログ出力のみ）
    """
    import json
    import os
    from pathlib import Path
    from datetime import datetime, timezone
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    await live_view_manager.send_log(execution.id, "INFO", "APIモードで実行開始（ブラウザ未使用）")

    # フォルダIDの取得（環境変数優先、なければタスクプロンプトから抽出）
    folder_art = os.getenv("DRIVE_FOLDER_ARTWORKS_ID")
    folder_vid = os.getenv("DRIVE_FOLDER_VIDEOS_ID")

    def extract_folder_id_from_prompt(prompt: str, default: str | None = None):
        import re
        m = re.search(r"/folders/([A-Za-z0-9_-]+)", prompt or "")
        return m.group(1) if m else default

    folder_art = folder_art or extract_folder_id_from_prompt(task.task_prompt, folder_art)
    folder_vid = folder_vid or extract_folder_id_from_prompt(task.task_prompt, folder_vid)

    if not folder_art or not folder_vid:
        msg = "監視フォルダIDが見つかりません（DRIVE_FOLDER_ARTWORKS_ID, DRIVE_FOLDER_VIDEOS_ID か task_prompt を確認）"
        await live_view_manager.send_log(execution.id, "ERROR", msg)
        execution.status = "failed"
        execution.error_message = msg
        if mark_completed:
            execution.completed_at = datetime.now()
            db.commit()
            await live_view_manager.send_execution_complete(execution.id, status="failed", error=msg)
        return {"success": False, "error": msg, "total_steps": 0}

    # 認証（サービスアカウント想定）
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path or not Path(cred_path).exists():
        msg = "Google認証情報が見つかりません（GOOGLE_APPLICATION_CREDENTIALS を設定してください）"
        await live_view_manager.send_log(execution.id, "ERROR", msg)
        execution.status = "failed"
        execution.error_message = msg
        if mark_completed:
            execution.completed_at = datetime.now()
            db.commit()
            await live_view_manager.send_execution_complete(execution.id, status="failed", error=msg)
        return {"success": False, "error": msg, "total_steps": 0}

    try:
        creds = service_account.Credentials.from_service_account_file(
            cred_path, scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
        drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        msg = f"Google Drive認証/初期化に失敗: {e}"
        await live_view_manager.send_log(execution.id, "ERROR", msg)
        execution.status = "failed"
        execution.error_message = msg
        if mark_completed:
            execution.completed_at = datetime.now()
            db.commit()
            await live_view_manager.send_execution_complete(execution.id, status="failed", error=msg)
        return {"success": False, "error": msg, "total_steps": 0}

    # 状態ファイル
    state_dir = Path("03_Processing")
    state_dir.mkdir(parents=True, exist_ok=True)
    state_path = state_dir / "state.json"
    state = {"last_checked": None, "processed_ids": []}
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text("utf-8"))
        except Exception:
            state = {"last_checked": None, "processed_ids": []}

    last_checked = state.get("last_checked")
    processed_ids = set(state.get("processed_ids") or [])

    def list_new_files(folder_id: str, mime_prefix: str | None = None):
        q_parts = [f"'{folder_id}' in parents", "trashed = false"]
        if mime_prefix:
            q_parts.append(f"mimeType contains '{mime_prefix}/'")
        if last_checked:
            q_parts.append(f"modifiedTime > '{last_checked}'")
        q = " and ".join(q_parts)
        return drive.files().list(
            q=q,
            fields="files(id, name, mimeType, modifiedTime, webContentLink, webViewLink)",
            orderBy="modifiedTime desc",
            pageSize=50,
        ).execute().get("files", [])

    try:
        await live_view_manager.send_log(execution.id, "INFO", "Step: Driveチェック開始")
        img_files = list_new_files(folder_art, "image")
        vid_files = list_new_files(folder_vid, "video")
        new_files = img_files + vid_files

        # processed_ids でフィルタ
        new_files = [f for f in new_files if f["id"] not in processed_ids]

        agent2_task_id = os.getenv("AGENT2_TASK_ID")
        if agent2_task_id:
            try:
                agent2_task_id = int(agent2_task_id)
            except Exception:
                agent2_task_id = None

        if new_files:
            await live_view_manager.send_log(
                execution.id,
                "INFO",
                f"Step: 新規{len(new_files)}件検知 → Agent2へ通知（プレースホルダー）"
            )
            # Agent2連携はプレースホルダー（実際の起動処理は別途実装）
            # ここでは検知結果を結果に記録
            result_msg = {
                "detected": [
                    {
                        "file_id": f["id"],
                        "file_name": f["name"],
                        "mimeType": f.get("mimeType"),
                        "modifiedTime": f.get("modifiedTime"),
                        "download_url": f.get("webContentLink") or f.get("webViewLink"),
                        "detected_at": datetime.now(timezone.utc).isoformat(),
                    }
                    for f in new_files
                ]
            }
            execution.result = json.dumps(result_msg, ensure_ascii=False)

            # Agent2が指定されていれば起動（簡易トリガー）
            if agent2_task_id and agent2_task_id != task.id:
                try:
                    # 新しいExecutionを作成し、バックグラウンドで起動
                    from app.models import Execution as ExecModel
                    agent2_exec = ExecModel(
                        task_id=agent2_task_id,
                        status="pending",
                        triggered_by="api_trigger",
                        started_at=datetime.utcnow()
                    )
                    db.add(agent2_exec)
                    db.commit()
                    db.refresh(agent2_exec)

                    await live_view_manager.send_log(
                        execution.id,
                        "INFO",
                        f"Agent2を起動しました (task_id={agent2_task_id}, execution_id={agent2_exec.id})"
                    )

                    # 非同期でAgent2を実行
                    from app.services.agent import run_task_with_live_view
                    asyncio.create_task(run_task_with_live_view(agent2_task_id, agent2_exec.id))
                except Exception as e:
                    await live_view_manager.send_log(
                        execution.id,
                        "ERROR",
                        f"Agent2起動に失敗: {e}"
                    )
        else:
            await live_view_manager.send_log(
                execution.id,
                "INFO",
                "Step: 新規ファイルなし"
            )
            execution.result = "新規ファイルなし"

        # 状態更新
        state["last_checked"] = datetime.now(timezone.utc).isoformat()
        state["processed_ids"] = list(processed_ids.union({f["id"] for f in new_files}))
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

        if mark_completed:
            execution.status = "completed"
            execution.completed_at = datetime.now()
            db.commit()
            await live_view_manager.send_execution_complete(
                execution.id,
                status="completed",
                result=execution.result
            )
        return {"success": True, "result": execution.result, "total_steps": 0}

    except HttpError as e:
        msg = f"Drive API呼び出しでエラー: {e}"
        await live_view_manager.send_log(execution.id, "ERROR", msg)
        execution.status = "failed"
        execution.error_message = msg
        if mark_completed:
            execution.completed_at = datetime.now()
            db.commit()
            await live_view_manager.send_execution_complete(execution.id, status="failed", error=msg)
        return {"success": False, "error": msg, "total_steps": 0}
    except Exception as e:
        msg = f"API実行中にエラー: {e}"
        await live_view_manager.send_log(execution.id, "ERROR", msg)
        execution.status = "failed"
        execution.error_message = msg
        if mark_completed:
            execution.completed_at = datetime.now()
            db.commit()
            await live_view_manager.send_execution_complete(execution.id, status="failed", error=msg)
        return {"success": False, "error": msg, "total_steps": 0}


async def run_task_with_live_view(task_id: int, execution_id: int):
    """ライブビュー対応でタスクを実行（バックグラウンドタスク用）
    
    execution_locationに応じて実行場所を決定:
    - server: サーバーで直接実行
    - local: ローカルエージェント経由で実行
    
    execution_typeに応じて適切なエージェントを選択:
    - web: Browser Use (Webブラウザ自動化)
    - desktop: Lux/OAGI (デスクトップ自動化)
    - hybrid: 両方を組み合わせ
    """
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        execution = db.query(Execution).filter(Execution.id == execution_id).first()
        
        if not task or not execution:
            logger.error(f"タスクまたは実行が見つかりません: task_id={task_id}, execution_id={execution_id}")
            return
        
        # 実行場所を確認
        execution_location = getattr(task, 'execution_location', 'server') or 'server'
        execution_type = getattr(task, 'execution_type', 'web') or 'web'
        
        # API専用タスク: ブラウザを使わずAPIのみで実行し、ライブビューは出さない
        if execution_type == "api":
            execution.status = "running"
            execution.started_at = datetime.now()
            db.commit()
            
            logger.info(f"APIモードで実行（ブラウザ未使用）: task_id={task_id}")
            result = await run_api_only_task(task, execution, db)
            
            if result.get("success"):
                execution.status = "completed"
                execution.result = result.get("result")
            else:
                execution.status = "failed"
                execution.error_message = result.get("error")
            execution.completed_at = datetime.now()
            db.commit()
            logger.info(f"タスク実行完了: task_id={task_id}, status={execution.status}, type={execution_type}")
            return
        
        # ハイブリッド: まずAPIパートを実行し、その後ブラウザ（ライブビューあり）
        if execution_type == "hybrid":
            execution.status = "running"
            execution.started_at = datetime.now()
            db.commit()
            
            logger.info(f"ハイブリッド実行開始（API前処理→ブラウザ）: task_id={task_id}")
            api_result = await run_api_only_task(task, execution, db, mark_completed=False)
            if not api_result.get("success"):
                execution.status = "failed"
                execution.error_message = api_result.get("error") or "API前処理で失敗しました"
                execution.completed_at = datetime.now()
                db.commit()
                await live_view_manager.send_execution_complete(
                    execution.id,
                    status="failed",
                    error=execution.error_message
                )
                return
        
        # ローカルエージェント経由の実行
        if execution_location == "local":
            logger.info(f"ローカルエージェント経由で実行: task_id={task_id}")
            from app.services.local_executor import run_on_local_agent
            result = await run_on_local_agent(task, execution, db)
            
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
            return
        
        # サーバーでの直接実行 → Browser Use（Webブラウザ自動化）のみ
        # デスクトップ操作はローカルエージェント経由でのみ実行可能
        
        if execution_type in ["desktop", "hybrid"]:
            # デスクトップ/ハイブリッドタスクがサーバー実行に設定されている場合
            # 自動的にWebモードにフォールバック、または警告
            logger.warning(
                f"デスクトップタスクがサーバー実行に設定されています。"
                f"Browser Use（Web）モードで実行します: task_id={task_id}"
            )
            await live_view_manager.send_log(
                execution.id,
                "WARNING",
                "デスクトップタスクですが、サーバー実行のためBrowser Use（Web）で実行します。"
                "デスクトップ操作が必要な場合は、実行場所を「ローカルPC」に変更してください。"
            )
        
        # 実行状態を更新
        execution.status = "running"
        execution.started_at = datetime.now()
        db.commit()
        
        # タイムアウト設定を取得
        from app.config import settings
        timeout_seconds = settings.execution_timeout_seconds
        
        # サーバー実行は常にBrowser Use（Web自動化）を使用
        agent = LiveViewAgent(
            task=task,
            execution=execution,
            db=db
        )
        logger.info(f"Webエージェント（Browser Use）を使用（サーバー実行）: task_id={task_id}, timeout={timeout_seconds}s")
        
        # タイムアウト付きで実行
        try:
            result = await asyncio.wait_for(agent.run(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            logger.error(f"タスク実行がタイムアウトしました: task_id={task_id}, timeout={timeout_seconds}s")
            # タイムアウト時の通知
            await live_view_manager.send_log(
                execution.id,
                "ERROR",
                f"タスクが{timeout_seconds}秒でタイムアウトしました。タスクを分割するか、タイムアウト設定を調整してください。"
            )
            result = {
                "success": False,
                "error": f"タスクが{timeout_seconds}秒でタイムアウトしました。\n\n対処法:\n- タスクを複数の小さなタスクに分割\n- より具体的な指示に変更\n- サーバーのタイムアウト設定を調整（現在: {timeout_seconds}秒）",
                "timeout": True
            }
        
        # 結果を保存
        if result.get("stopped"):
            execution.status = "stopped"
        elif result.get("timeout"):
            execution.status = "failed"
            execution.error_message = result.get("error")
        elif result.get("success"):
            execution.status = "completed"
            execution.result = result.get("result")
        else:
            execution.status = "failed"
            error_msg = result.get("error")
            # よくあるエラーに対する簡易サジェスト（例: Browser Use 未インストール/古い）
            suggestion = None
            if error_msg:
                if "Browser Use" in error_msg or "browser_use" in error_msg:
                    suggestion = "Browser Useが古い/未インストールの可能性があります。サーバーで `pip install -U browser-use` を実行してください。"
                if "BrowserProfile" in error_msg:
                    suggestion = "BrowserProfileが見つかりません。browser-useを最新に更新するか、互換モードで起動してください。"
            if suggestion:
                execution.error_message = f"{error_msg}\n\n提案: {suggestion}"
            else:
                execution.error_message = error_msg
        
        execution.completed_at = datetime.now()
        db.commit()
        
        logger.info(f"タスク実行完了: task_id={task_id}, status={execution.status}, type={execution_type}")
        
    except Exception as e:
        logger.error(f"タスク実行エラー: {e}")
        if execution:
            # よくあるエラーに対する簡易サジェスト
            suggestion = None
            msg = str(e)
            if "Browser Use" in msg or "browser_use" in msg:
                suggestion = "Browser Useが古い/未インストールの可能性があります。サーバーで `pip install -U browser-use` を実行してください。"
            if "BrowserProfile" in msg:
                suggestion = "BrowserProfileが見つかりません。browser-useを最新に更新するか、互換モードで起動してください。"
            execution.status = "failed"
            execution.error_message = f"{msg}\n\n提案: {suggestion}" if suggestion else msg
            execution.completed_at = datetime.now()
            db.commit()
    finally:
        # LiveViewManagerのクリーンアップは少し遅延（クライアントが結果を受け取れるように）
        await asyncio.sleep(2)
        live_view_manager.cleanup(execution_id)
        db.close()

