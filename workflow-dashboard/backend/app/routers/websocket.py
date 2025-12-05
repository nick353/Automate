"""WebSocket エンドポイント"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio

from app.services.live_view_manager import live_view_manager
from app.services.screencast import screencast_manager
from app.utils.logger import logger

router = APIRouter(tags=["websocket"])

# ダッシュボード用の接続を管理
dashboard_connections: List[WebSocket] = []


@router.websocket("/ws/live/{execution_id}")
async def live_view_websocket(websocket: WebSocket, execution_id: int):
    """ライブビュー用WebSocket"""
    await websocket.accept()
    live_view_manager.add_connection(execution_id, websocket)
    
    try:
        # 初期データを送信
        screenshot = live_view_manager.get_cached_screenshot(execution_id)
        if screenshot:
            await websocket.send_json({
                "type": "screenshot_update",
                "data": {"screenshot": screenshot}
            })
        
        # キャッシュされたログを送信
        logs = live_view_manager.get_cached_logs(execution_id)
        if logs:
            await websocket.send_json({
                "type": "initial_logs",
                "data": {"logs": logs}
            })
        
        # 接続を維持
        while True:
            try:
                # クライアントからのメッセージを待つ（ping/pong用）
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
    finally:
        live_view_manager.remove_connection(execution_id, websocket)


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    """ダッシュボード更新通知用WebSocket"""
    await websocket.accept()
    dashboard_connections.append(websocket)
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
    finally:
        if websocket in dashboard_connections:
            dashboard_connections.remove(websocket)


async def broadcast_to_dashboard(message: dict):
    """ダッシュボードの全接続にメッセージを配信"""
    dead_connections = []
    
    for ws in dashboard_connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead_connections.append(ws)
    
    for ws in dead_connections:
        if ws in dashboard_connections:
            dashboard_connections.remove(ws)


@router.websocket("/ws/executions/{execution_id}")
async def execution_websocket(websocket: WebSocket, execution_id: int):
    """実行ログのリアルタイム配信用WebSocket（後方互換性）"""
    # live_view_websocketにリダイレクト
    await live_view_websocket(websocket, execution_id)


@router.websocket("/ws/screencast/{execution_id}")
async def screencast_websocket(websocket: WebSocket, execution_id: int):
    """
    スクリーンキャスト（リアルタイム画面配信）用WebSocket
    
    オンデマンドで接続 - ユーザーが「ライブビュー」ボタンを押したときのみ開始
    """
    await websocket.accept()
    is_viewing = False
    
    logger.info(f"スクリーンキャストWebSocket接続: execution_id={execution_id}")
    
    async def send_frame(frame_data: str):
        """フレームをWebSocketに送信"""
        try:
            await websocket.send_json({
                "type": "frame",
                "data": frame_data
            })
        except Exception as e:
            logger.warning(f"フレーム送信エラー: {e}")
    
    try:
        # ページが登録されているか確認
        if not screencast_manager.is_page_registered(execution_id):
            await websocket.send_json({
                "type": "error",
                "message": "実行中のタスクが見つかりません。タスクが実行中であることを確認してください。"
            })
            await websocket.close()
            return
        
        # スクリーンキャスト開始
        success = await screencast_manager.start_viewing(execution_id, send_frame)
        if success:
            is_viewing = True
            await websocket.send_json({
                "type": "started",
                "message": "ライブビュー開始"
            })
        else:
            await websocket.send_json({
                "type": "error",
                "message": "ライブビューの開始に失敗しました"
            })
            await websocket.close()
            return
        
        # 接続を維持
        while True:
            try:
                data = await websocket.receive_text()
                
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "stop":
                    # 手動で視聴停止
                    break
                    
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        logger.error(f"スクリーンキャストエラー: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except Exception:
            pass
    finally:
        # クリーンアップ
        if is_viewing:
            await screencast_manager.stop_viewing(execution_id)
        logger.info(f"スクリーンキャストWebSocket切断: execution_id={execution_id}")


@router.get("/screencast/status/{execution_id}")
async def get_screencast_status(execution_id: int):
    """スクリーンキャストの状態を取得"""
    return {
        "available": screencast_manager.is_page_registered(execution_id),
        "streaming": screencast_manager.is_streaming(execution_id),
        "viewer_count": screencast_manager.get_viewer_count(execution_id)
    }

