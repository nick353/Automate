"""
ハイブリッドエージェント - WebとデスクトップをMIXした自動化

タスクの内容を分析して、適切なエージェント（Browser Use / Lux）を
自動で切り替えます。

切り替えの判断基準:
- デスクトップアプリのキーワード（Excel, Word, Finder, Slack app等）→ Lux
- Webブラウザのキーワード（URL, サイト, ログイン等）→ Browser Use
- ファイル操作のキーワード（保存、ダウンロード、フォルダ）→ Lux
"""

import asyncio
import re
from datetime import datetime
from typing import Optional, List, Tuple
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Task, Execution
from app.services.browser_controller import browser_controller, ExecutionState
from app.services.live_view_manager import live_view_manager
from app.utils.logger import logger


# デスクトップ操作を示すキーワード
DESKTOP_KEYWORDS = [
    # macOS アプリ
    "finder", "terminal", "preview", "keynote", "numbers", "pages",
    "activity monitor", "system preferences", "システム環境設定",
    # 共通アプリ
    "excel", "word", "powerpoint", "outlook", "teams", "slack app",
    "vscode", "visual studio", "sublime", "atom", "notepad",
    "photoshop", "illustrator", "figma app",
    # ファイル操作
    "ファイルを開", "フォルダを", "保存する", "名前をつけて保存",
    "デスクトップに", "ドキュメントに", "ダウンロードフォルダ",
    "コピーして貼り付け", "ドラッグ", "右クリック",
    # システム操作
    "通知センター", "コントロールセンター", "spotlight",
    "アプリを起動", "アプリを開く", "アプリケーション",
]

# Web操作を示すキーワード
WEB_KEYWORDS = [
    # URL関連
    "http://", "https://", "www.", ".com", ".jp", ".org", ".net",
    # ブラウザ操作
    "ウェブサイト", "webサイト", "サイトにアクセス", "ページを開",
    "ログインページ", "ログインする", "サインイン",
    "フォームに入力", "ボタンをクリック", "リンクをクリック",
    "検索結果", "google", "yahoo", "bing",
    # Web固有の操作
    "ブラウザ", "chrome", "safari", "firefox", "edge",
    "タブを開く", "新しいタブ",
]


@dataclass
class TaskSegment:
    """タスクのセグメント（Web/Desktopに分割）"""
    content: str
    agent_type: str  # "web" or "desktop"
    order: int


class HybridAgent:
    """WebとデスクトップをMIXしたハイブリッドエージェント"""
    
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
    
    def _analyze_task(self, prompt: str) -> List[TaskSegment]:
        """
        タスクプロンプトを分析して、WebとDesktopのセグメントに分割
        
        例:
        "Webサイトからデータをダウンロードして、Excelで加工する"
        → [("Webサイトからデータをダウンロード", "web"), ("Excelで加工", "desktop")]
        """
        # シンプルな実装: タスク全体をどちらで実行するか判断
        prompt_lower = prompt.lower()
        
        desktop_score = 0
        web_score = 0
        
        for keyword in DESKTOP_KEYWORDS:
            if keyword.lower() in prompt_lower:
                desktop_score += 1
        
        for keyword in WEB_KEYWORDS:
            if keyword.lower() in prompt_lower:
                web_score += 1
        
        # 行ごとに分析してセグメントを作成
        lines = prompt.strip().split('\n')
        segments = []
        current_segment = []
        current_type = None
        
        for i, line in enumerate(lines):
            line_lower = line.lower()
            
            # この行のスコアを計算
            line_desktop = sum(1 for k in DESKTOP_KEYWORDS if k.lower() in line_lower)
            line_web = sum(1 for k in WEB_KEYWORDS if k.lower() in line_lower)
            
            if line_desktop > line_web:
                line_type = "desktop"
            elif line_web > line_desktop:
                line_type = "web"
            else:
                # 前のセグメントと同じタイプを継続
                line_type = current_type or ("web" if web_score >= desktop_score else "desktop")
            
            if current_type is None:
                current_type = line_type
            
            if line_type == current_type:
                current_segment.append(line)
            else:
                # セグメントを保存して新しいセグメントを開始
                if current_segment:
                    segments.append(TaskSegment(
                        content='\n'.join(current_segment),
                        agent_type=current_type,
                        order=len(segments)
                    ))
                current_segment = [line]
                current_type = line_type
        
        # 最後のセグメントを保存
        if current_segment:
            segments.append(TaskSegment(
                content='\n'.join(current_segment),
                agent_type=current_type,
                order=len(segments)
            ))
        
        # セグメントがない場合はタスク全体を1つのセグメントに
        if not segments:
            default_type = "desktop" if desktop_score > web_score else "web"
            segments.append(TaskSegment(
                content=prompt,
                agent_type=default_type,
                order=0
            ))
        
        return segments
    
    def _get_dominant_type(self, prompt: str) -> str:
        """タスクの主要な実行タイプを判断"""
        prompt_lower = prompt.lower()
        
        desktop_score = sum(1 for k in DESKTOP_KEYWORDS if k.lower() in prompt_lower)
        web_score = sum(1 for k in WEB_KEYWORDS if k.lower() in prompt_lower)
        
        if desktop_score > web_score:
            return "desktop"
        return "web"
    
    async def run(self) -> dict:
        """ハイブリッドタスクを実行"""
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
            
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                f"ハイブリッドタスク開始: {self.task.name}"
            )
            
            # タスクを分析
            segments = self._analyze_task(self.task.task_prompt)
            
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                f"タスクを {len(segments)} セグメントに分割しました"
            )
            
            for seg in segments:
                await live_view_manager.send_log(
                    self.execution.id,
                    "INFO",
                    f"  - セグメント{seg.order + 1}: {seg.agent_type} ({seg.content[:50]}...)"
                )
            
            results = []
            
            for segment in segments:
                # 一時停止チェック
                should_continue = await browser_controller.wait_if_paused(self.execution.id)
                if not should_continue:
                    raise InterruptedError("実行が停止されました")
                
                await live_view_manager.send_log(
                    self.execution.id,
                    "INFO",
                    f"セグメント {segment.order + 1} 開始: {segment.agent_type}モード"
                )
                
                # 適切なエージェントで実行
                if segment.agent_type == "desktop":
                    result = await self._run_desktop_segment(segment)
                else:
                    result = await self._run_web_segment(segment)
                
                results.append(result)
                
                if not result.get("success"):
                    # セグメントが失敗したら全体を失敗とする
                    await live_view_manager.send_execution_complete(
                        self.execution.id,
                        status="failed",
                        error=result.get("error")
                    )
                    return {
                        "success": False,
                        "error": result.get("error"),
                        "results": results,
                        "total_steps": self.step_count
                    }
            
            # 全セグメント完了
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                "ハイブリッドタスク完了"
            )
            
            await live_view_manager.send_execution_complete(
                self.execution.id,
                status="completed"
            )
            
            return {
                "success": True,
                "results": results,
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
            logger.error(f"ハイブリッドエージェント実行エラー: {e}")
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
    
    async def _run_web_segment(self, segment: TaskSegment) -> dict:
        """Webセグメントを実行（Browser Use）"""
        from app.services.agent import LiveViewAgent
        
        # 一時的なタスクオブジェクトを作成（セグメント用のプロンプト）
        temp_task = type(self.task)()
        for attr in ['id', 'name', 'description', 'llm_credential_id', 'site_credential_id', 'max_steps']:
            setattr(temp_task, attr, getattr(self.task, attr))
        temp_task.task_prompt = segment.content
        
        agent = LiveViewAgent(
            task=temp_task,
            execution=self.execution,
            db=self.db
        )
        
        # エージェントの step_count を引き継ぐ
        agent.step_count = self.step_count
        
        result = await agent.run()
        
        # step_count を更新
        self.step_count = agent.step_count
        
        return result
    
    async def _run_desktop_segment(self, segment: TaskSegment) -> dict:
        """デスクトップセグメントを実行（Lux）"""
        from app.services.desktop_agent import DesktopAgent
        
        # 一時的なタスクオブジェクトを作成
        temp_task = type(self.task)()
        for attr in ['id', 'name', 'description', 'lux_credential_id', 'site_credential_id', 'max_steps']:
            if hasattr(self.task, attr):
                setattr(temp_task, attr, getattr(self.task, attr))
        temp_task.task_prompt = segment.content
        
        agent = DesktopAgent(
            task=temp_task,
            execution=self.execution,
            db=self.db
        )
        
        # エージェントの step_count を引き継ぐ
        agent.step_count = self.step_count
        
        result = await agent.run()
        
        # step_count を更新
        self.step_count = agent.step_count
        
        return result


