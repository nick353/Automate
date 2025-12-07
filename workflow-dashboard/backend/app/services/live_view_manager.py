"""ライブビュー管理サービス"""
import asyncio
import json
from datetime import datetime
from typing import Optional, List
from pathlib import Path


class LiveViewManager:
    """ライブビューのデータ管理とWebSocket配信"""
    
    def __init__(self):
        self._connections: dict[int, list] = {}  # execution_id -> WebSocket connections
        self._screenshot_cache: dict[int, str] = {}  # execution_id -> base64 screenshot
        self._log_cache: dict[int, List[dict]] = {}  # execution_id -> log entries
    
    def add_connection(self, execution_id: int, websocket):
        """WebSocket接続を追加"""
        if execution_id not in self._connections:
            self._connections[execution_id] = []
        self._connections[execution_id].append(websocket)
    
    def remove_connection(self, execution_id: int, websocket):
        """WebSocket接続を削除"""
        if execution_id in self._connections:
            self._connections[execution_id] = [
                ws for ws in self._connections[execution_id] if ws != websocket
            ]
    
    def get_connection_count(self, execution_id: int) -> int:
        """接続数を取得"""
        return len(self._connections.get(execution_id, []))
    
    async def broadcast(self, execution_id: int, message: dict):
        """指定実行IDの全接続にメッセージを配信"""
        connections = self._connections.get(execution_id, [])
        dead_connections = []
        
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)
        
        # 切断された接続を削除
        for ws in dead_connections:
            self.remove_connection(execution_id, ws)
    
    async def send_step_update(
        self, 
        execution_id: int, 
        step_number: int,
        action_type: str,
        description: str,
        status: str,
        screenshot_base64: Optional[str] = None,
        duration_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """ステップ更新を配信"""
        message = {
            "type": "step_update",
            "data": {
                "step_number": step_number,
                "action_type": action_type,
                "description": description,
                "status": status,
                "duration_ms": duration_ms,
                "error_message": error_message,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # スクリーンショットは別メッセージで送信（サイズが大きいため）
        if screenshot_base64:
            self._screenshot_cache[execution_id] = screenshot_base64
            screenshot_message = {
                "type": "screenshot_update",
                "data": {
                    "step_number": step_number,
                    "screenshot": screenshot_base64
                }
            }
            await self.broadcast(execution_id, screenshot_message)
        
        await self.broadcast(execution_id, message)
    
    async def send_log(self, execution_id: int, level: str, message: str):
        """ログメッセージを配信"""
        log_entry = {
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        # キャッシュに追加
        if execution_id not in self._log_cache:
            self._log_cache[execution_id] = []
        self._log_cache[execution_id].append(log_entry)
        
        # 最新100件のみ保持
        if len(self._log_cache[execution_id]) > 100:
            self._log_cache[execution_id] = self._log_cache[execution_id][-100:]
        
        log_message = {
            "type": "log",
            "data": log_entry
        }
        await self.broadcast(execution_id, log_message)
    
    async def send_control_update(self, execution_id: int, status: str):
        """制御状態の更新を配信"""
        message = {
            "type": "control_update",
            "data": {
                "status": status,
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(execution_id, message)
    
    async def send_progress_update(
        self, 
        execution_id: int, 
        current_step: int, 
        total_steps: int
    ):
        """進捗更新を配信"""
        message = {
            "type": "progress_update",
            "data": {
                "current_step": current_step,
                "total_steps": total_steps,
                "percentage": round(current_step / total_steps * 100) if total_steps > 0 else 0
            }
        }
        await self.broadcast(execution_id, message)
    
    async def send_execution_complete(self, execution_id: int, status: str, result: Optional[str] = None, error: Optional[str] = None):
        """実行完了を配信"""
        message = {
            "type": "execution_complete",
            "data": {
                "status": status,
                "result": result,
                "error": error,
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(execution_id, message)
    
    def get_cached_screenshot(self, execution_id: int) -> Optional[str]:
        """キャッシュされたスクリーンショットを取得"""
        return self._screenshot_cache.get(execution_id)
    
    def get_cached_logs(self, execution_id: int) -> List[dict]:
        """キャッシュされたログを取得"""
        return self._log_cache.get(execution_id, [])
    
    def cleanup(self, execution_id: int):
        """実行終了時のクリーンアップ"""
        self._connections.pop(execution_id, None)
        self._screenshot_cache.pop(execution_id, None)
        self._log_cache.pop(execution_id, None)


# シングルトンインスタンス
live_view_manager = LiveViewManager()



