"""
リモートエージェントサーバー

ユーザーのローカルPCで実行して、ダッシュボード（サーバー）から指示を受けて
ローカルのデスクトップを操作するエージェント。

使い方:
1. ユーザーのPCでこのスクリプトを実行
2. ダッシュボードで表示される接続コードを入力
3. サーバーからの指示を受けてローカルで実行

実行:
    pip install oagi websockets
    python remote_agent_server.py --server wss://your-server.com/ws/agent
"""

import asyncio
import json
import os
import base64
import argparse
from datetime import datetime
from typing import Optional

try:
    import websockets
except ImportError:
    print("websockets パッケージが必要です: pip install websockets")
    exit(1)


class RemoteAgentClient:
    """リモートエージェントクライアント（ユーザーのPC側で実行）"""
    
    def __init__(self, server_url: str, agent_id: str):
        self.server_url = server_url
        self.agent_id = agent_id
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.running = False
        self.oagi_available = False
        
        # OAGI SDKの確認
        try:
            from oagi import AsyncDefaultAgent, AsyncPyautoguiActionHandler, AsyncScreenshotMaker
            self.oagi_available = True
            print("✅ OAGI SDK が利用可能です")
        except ImportError:
            print("⚠️  OAGI SDK がインストールされていません")
            print("   pip install oagi でインストールしてください")
    
    async def connect(self):
        """サーバーに接続"""
        try:
            self.ws = await websockets.connect(
                f"{self.server_url}?agent_id={self.agent_id}"
            )
            print(f"✅ サーバーに接続しました: {self.server_url}")
            print(f"   エージェントID: {self.agent_id}")
            self.running = True
            return True
        except Exception as e:
            print(f"❌ 接続エラー: {e}")
            return False
    
    async def send_status(self, status: str, data: dict = None):
        """ステータスをサーバーに送信"""
        if self.ws:
            message = {
                "type": "status",
                "agent_id": self.agent_id,
                "status": status,
                "data": data or {},
                "timestamp": datetime.now().isoformat()
            }
            await self.ws.send(json.dumps(message))
    
    async def send_screenshot(self):
        """スクリーンショットを送信"""
        try:
            import pyautogui
            from PIL import Image
            import io
            
            screenshot = pyautogui.screenshot()
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG', optimize=True)
            screenshot_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            if self.ws:
                await self.ws.send(json.dumps({
                    "type": "screenshot",
                    "agent_id": self.agent_id,
                    "data": screenshot_base64,
                    "timestamp": datetime.now().isoformat()
                }))
        except Exception as e:
            print(f"スクリーンショット送信エラー: {e}")
    
    async def execute_task(self, task_prompt: str, max_steps: int = 20) -> dict:
        """タスクを実行"""
        if not self.oagi_available:
            return {"success": False, "error": "OAGI SDK がインストールされていません"}
        
        try:
            from oagi import AsyncDefaultAgent, AsyncPyautoguiActionHandler, AsyncScreenshotMaker
            
            print(f"\n🚀 タスク実行開始: {task_prompt[:50]}...")
            
            await self.send_status("running", {"task": task_prompt})
            
            # エージェントを作成
            agent = AsyncDefaultAgent(max_steps=max_steps)
            action_handler = AsyncPyautoguiActionHandler()
            screenshot_maker = AsyncScreenshotMaker()
            
            # 定期的にスクリーンショットを送信
            screenshot_task = asyncio.create_task(self._periodic_screenshot())
            
            try:
                result = await agent.execute(
                    task_prompt,
                    action_handler=action_handler,
                    image_provider=screenshot_maker
                )
                
                await self.send_status("completed", {"result": str(result)})
                print(f"✅ タスク完了")
                
                return {"success": True, "result": str(result)}
                
            finally:
                screenshot_task.cancel()
                try:
                    await screenshot_task
                except asyncio.CancelledError:
                    pass
                    
        except Exception as e:
            print(f"❌ タスク実行エラー: {e}")
            await self.send_status("failed", {"error": str(e)})
            return {"success": False, "error": str(e)}
    
    async def _periodic_screenshot(self):
        """定期的にスクリーンショットを送信"""
        while True:
            await asyncio.sleep(1.0)
            await self.send_screenshot()
    
    async def listen(self):
        """サーバーからのメッセージを待機"""
        if not self.ws:
            return
        
        print("\n🎧 サーバーからの指示を待機中...")
        print("   Ctrl+C で終了\n")
        
        try:
            async for message in self.ws:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "execute":
                    # タスク実行指示
                    task_prompt = data.get("task_prompt", "")
                    max_steps = data.get("max_steps", 20)
                    result = await self.execute_task(task_prompt, max_steps)
                    
                    # 結果を送信
                    await self.ws.send(json.dumps({
                        "type": "result",
                        "agent_id": self.agent_id,
                        "execution_id": data.get("execution_id"),
                        "result": result,
                        "timestamp": datetime.now().isoformat()
                    }))
                    
                elif msg_type == "screenshot":
                    # スクリーンショット要求
                    await self.send_screenshot()
                    
                elif msg_type == "ping":
                    # ヘルスチェック
                    await self.ws.send(json.dumps({
                        "type": "pong",
                        "agent_id": self.agent_id,
                        "timestamp": datetime.now().isoformat()
                    }))
                    
                elif msg_type == "stop":
                    print("🛑 停止指示を受信")
                    break
                    
        except websockets.ConnectionClosed:
            print("⚠️  サーバーとの接続が切断されました")
        except Exception as e:
            print(f"❌ エラー: {e}")
        finally:
            self.running = False
    
    async def run(self):
        """メインループ"""
        while True:
            if await self.connect():
                await self.send_status("ready", {
                    "oagi_available": self.oagi_available,
                    "platform": os.uname().sysname if hasattr(os, 'uname') else "unknown"
                })
                await self.listen()
            
            print("5秒後に再接続を試みます...")
            await asyncio.sleep(5)


def check_permissions():
    """システム権限をチェック"""
    print("\n🔐 システム権限チェック...")
    
    try:
        import subprocess
        result = subprocess.run(
            ["oagi", "agent", "permission"],
            capture_output=True,
            text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr)
    except FileNotFoundError:
        print("   oagi コマンドが見つかりません。pip install oagi を実行してください。")
    except Exception as e:
        print(f"   権限チェックエラー: {e}")


def main():
    parser = argparse.ArgumentParser(description="リモートエージェントクライアント")
    parser.add_argument(
        "--server",
        default="ws://localhost:8000/ws/remote-agent",
        help="サーバーのWebSocket URL"
    )
    parser.add_argument(
        "--agent-id",
        default=None,
        help="エージェントID（指定しない場合は自動生成）"
    )
    parser.add_argument(
        "--check-permissions",
        action="store_true",
        help="システム権限をチェックして終了"
    )
    
    args = parser.parse_args()
    
    if args.check_permissions:
        check_permissions()
        return
    
    # エージェントIDの生成
    agent_id = args.agent_id
    if not agent_id:
        import uuid
        agent_id = str(uuid.uuid4())[:8]
    
    print("=" * 50)
    print("  Workflow Dashboard - リモートエージェント")
    print("=" * 50)
    print(f"\nサーバー: {args.server}")
    print(f"エージェントID: {agent_id}")
    
    # 権限チェック
    check_permissions()
    
    # OAGI APIキーの確認
    if not os.environ.get("OAGI_API_KEY"):
        print("\n⚠️  OAGI_API_KEY 環境変数が設定されていません")
        print("   export OAGI_API_KEY=your-api-key")
    
    # クライアントを実行
    client = RemoteAgentClient(args.server, agent_id)
    
    try:
        asyncio.run(client.run())
    except KeyboardInterrupt:
        print("\n\n👋 終了します")


if __name__ == "__main__":
    main()

