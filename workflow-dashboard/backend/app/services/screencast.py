"""CDPスクリーンキャストサービス"""
import asyncio
import base64
from typing import Optional, Callable, Dict
from datetime import datetime

from app.utils.logger import logger


class ScreencastSession:
    """個別のスクリーンキャストセッション"""
    
    def __init__(self, execution_id: int):
        self.execution_id = execution_id
        self.cdp_session = None
        self.is_active = False
        self.frame_callback: Optional[Callable] = None
        self.last_frame: Optional[str] = None
        self.frame_count = 0
    
    async def start(self, page, frame_callback: Callable):
        """スクリーンキャストを開始"""
        if self.is_active:
            return
        
        try:
            self.frame_callback = frame_callback
            self.is_active = True
            
            # CDPセッションを作成
            self.cdp_session = await page.context.new_cdp_session(page)
            
            # フレーム受信ハンドラを設定
            self.cdp_session.on('Page.screencastFrame', self._on_frame)
            
            # スクリーンキャストを開始
            await self.cdp_session.send('Page.startScreencast', {
                'format': 'jpeg',
                'quality': 60,  # 品質（1-100）
                'maxWidth': 1280,
                'maxHeight': 720,
                'everyNthFrame': 2  # 2フレームごとに1フレーム送信（パフォーマンス調整）
            })
            
            logger.info(f"スクリーンキャスト開始: execution_id={self.execution_id}")
            
        except Exception as e:
            logger.error(f"スクリーンキャスト開始エラー: {e}")
            self.is_active = False
            raise
    
    async def _on_frame(self, params):
        """フレーム受信時のハンドラ"""
        if not self.is_active:
            return
        
        try:
            frame_data = params.get('data', '')
            session_id = params.get('sessionId', 0)
            
            self.last_frame = frame_data
            self.frame_count += 1
            
            # コールバックでフレームを配信
            if self.frame_callback:
                await self.frame_callback(frame_data)
            
            # フレームを確認応答（次のフレームを受信するために必要）
            if self.cdp_session:
                await self.cdp_session.send('Page.screencastFrameAck', {
                    'sessionId': session_id
                })
                
        except Exception as e:
            logger.warning(f"フレーム処理エラー: {e}")
    
    async def stop(self):
        """スクリーンキャストを停止"""
        if not self.is_active:
            return
        
        self.is_active = False
        
        try:
            if self.cdp_session:
                await self.cdp_session.send('Page.stopScreencast')
                await self.cdp_session.detach()
                self.cdp_session = None
            
            logger.info(f"スクリーンキャスト停止: execution_id={self.execution_id}, frames={self.frame_count}")
            
        except Exception as e:
            logger.warning(f"スクリーンキャスト停止エラー: {e}")
        
        self.frame_callback = None


class ScreencastManager:
    """スクリーンキャストの管理"""
    
    def __init__(self):
        self._sessions: Dict[int, ScreencastSession] = {}
        self._pages: Dict[int, any] = {}  # execution_id -> page
        self._viewers: Dict[int, int] = {}  # execution_id -> viewer count
    
    def register_page(self, execution_id: int, page):
        """ページを登録（タスク実行開始時に呼び出す）"""
        self._pages[execution_id] = page
        self._viewers[execution_id] = 0
        logger.info(f"ページ登録: execution_id={execution_id}")
    
    def unregister_page(self, execution_id: int):
        """ページの登録を解除（タスク実行終了時に呼び出す）"""
        self._pages.pop(execution_id, None)
        self._viewers.pop(execution_id, None)
        
        # セッションがあれば停止
        if execution_id in self._sessions:
            asyncio.create_task(self._sessions[execution_id].stop())
            del self._sessions[execution_id]
        
        logger.info(f"ページ登録解除: execution_id={execution_id}")
    
    def get_page(self, execution_id: int):
        """登録されたページを取得"""
        return self._pages.get(execution_id)
    
    def is_page_registered(self, execution_id: int) -> bool:
        """ページが登録されているか確認"""
        return execution_id in self._pages
    
    async def start_viewing(self, execution_id: int, frame_callback: Callable) -> bool:
        """視聴を開始"""
        page = self._pages.get(execution_id)
        if not page:
            logger.warning(f"ページが見つかりません: execution_id={execution_id}")
            return False
        
        # 視聴者数を増加
        self._viewers[execution_id] = self._viewers.get(execution_id, 0) + 1
        
        # セッションがなければ作成して開始
        if execution_id not in self._sessions:
            session = ScreencastSession(execution_id)
            self._sessions[execution_id] = session
            await session.start(page, frame_callback)
        else:
            # 既存セッションにコールバックを更新
            self._sessions[execution_id].frame_callback = frame_callback
        
        return True
    
    async def stop_viewing(self, execution_id: int):
        """視聴を停止"""
        if execution_id not in self._viewers:
            return
        
        # 視聴者数を減少
        self._viewers[execution_id] = max(0, self._viewers.get(execution_id, 1) - 1)
        
        # 視聴者がいなくなったらスクリーンキャストを停止
        if self._viewers[execution_id] == 0 and execution_id in self._sessions:
            await self._sessions[execution_id].stop()
            del self._sessions[execution_id]
    
    def get_last_frame(self, execution_id: int) -> Optional[str]:
        """最新フレームを取得"""
        session = self._sessions.get(execution_id)
        return session.last_frame if session else None
    
    def get_viewer_count(self, execution_id: int) -> int:
        """視聴者数を取得"""
        return self._viewers.get(execution_id, 0)
    
    def is_streaming(self, execution_id: int) -> bool:
        """ストリーミング中か確認"""
        session = self._sessions.get(execution_id)
        return session.is_active if session else False


# シングルトンインスタンス
screencast_manager = ScreencastManager()





