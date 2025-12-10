"""ブラウザ実行制御サービス"""
import asyncio
from typing import Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ExecutionState:
    """実行状態を管理するクラス"""
    execution_id: int
    is_paused: bool = False
    is_stopping: bool = False
    is_stopped: bool = False
    current_step: int = 0
    total_steps: int = 0
    pause_event: asyncio.Event = field(default_factory=asyncio.Event)
    
    def __post_init__(self):
        self.pause_event.set()  # 初期状態は実行可能


class BrowserController:
    """ブラウザ実行の制御（一時停止・停止）を管理"""
    
    def __init__(self):
        self._states: dict[int, ExecutionState] = {}
        self._callbacks: dict[int, list[Callable]] = {}
    
    def register_execution(self, execution_id: int) -> ExecutionState:
        """新しい実行を登録"""
        state = ExecutionState(execution_id=execution_id)
        self._states[execution_id] = state
        self._callbacks[execution_id] = []
        return state
    
    def get_state(self, execution_id: int) -> Optional[ExecutionState]:
        """実行状態を取得"""
        return self._states.get(execution_id)
    
    def add_callback(self, execution_id: int, callback: Callable):
        """状態変更時のコールバックを追加"""
        if execution_id in self._callbacks:
            self._callbacks[execution_id].append(callback)
    
    async def pause(self, execution_id: int) -> bool:
        """実行を一時停止"""
        state = self._states.get(execution_id)
        if not state or state.is_stopping:
            return False
        
        state.is_paused = True
        state.pause_event.clear()  # 待機状態に
        await self._notify_callbacks(execution_id, "paused")
        return True
    
    async def resume(self, execution_id: int) -> bool:
        """実行を再開"""
        state = self._states.get(execution_id)
        if not state or not state.is_paused:
            return False
        
        state.is_paused = False
        state.pause_event.set()  # 実行再開
        await self._notify_callbacks(execution_id, "resumed")
        return True
    
    async def stop(self, execution_id: int) -> bool:
        """実行を停止"""
        state = self._states.get(execution_id)
        if not state:
            return False
        
        state.is_stopping = True
        state.pause_event.set()  # 一時停止中なら解除
        await self._notify_callbacks(execution_id, "stopping")
        return True
    
    async def wait_if_paused(self, execution_id: int) -> bool:
        """一時停止中なら待機。停止リクエストがあればFalseを返す"""
        state = self._states.get(execution_id)
        if not state:
            return False
        
        await state.pause_event.wait()
        return not state.is_stopping
    
    def should_continue(self, execution_id: int) -> bool:
        """実行を続行すべきか確認"""
        state = self._states.get(execution_id)
        if not state:
            return False
        return not state.is_stopping
    
    def cleanup(self, execution_id: int):
        """実行終了時のクリーンアップ"""
        self._states.pop(execution_id, None)
        self._callbacks.pop(execution_id, None)
    
    async def _notify_callbacks(self, execution_id: int, event: str):
        """コールバックを呼び出し"""
        for callback in self._callbacks.get(execution_id, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception:
                pass


# シングルトンインスタンス
browser_controller = BrowserController()





