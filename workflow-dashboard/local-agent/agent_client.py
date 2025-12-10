#!/usr/bin/env python3
"""
Workflow Dashboard - ローカルエージェントクライアント

このスクリプトをPCで実行すると、ダッシュボードからリモートで
デスクトップを自動操作できます。

セットアップ:
    1. pip install oagi websockets
    2. OAGI APIキーを環境変数に設定:
       export OAGI_API_KEY="your-api-key"
    3. macOSの場合、画面収録・アクセシビリティ権限を付与

使用方法:
    python agent_client.py --server http://localhost:8000

オプション:
    --server URL    サーバーのURL（デフォルト: http://localhost:8000）
    --agent-id ID   エージェントID（指定しない場合は自動生成）
    --check         権限チェックのみ行う
"""

import asyncio
import argparse
import base64
import io
import json
import os
import platform
import sys
import uuid
from datetime import datetime
from typing import Optional

# バージョン
VERSION = "1.0.0"


def print_banner():
    """バナーを表示"""
    print("""
╔═══════════════════════════════════════════════════════════════╗
║       Workflow Dashboard - Local Agent Client v{version}        ║
║                                                               ║
║   AIと一緒にPCを自動操作するためのローカルエージェント        ║
╚═══════════════════════════════════════════════════════════════╝
""".format(version=VERSION))


def check_dependencies():
    """依存パッケージを確認"""
    missing = []
    
    try:
        import websockets
    except ImportError:
        missing.append("websockets")
    
    try:
        import pyautogui
    except ImportError:
        missing.append("pyautogui")
    
    try:
        from PIL import Image
    except ImportError:
        missing.append("pillow")
    
    if missing:
        print("❌ 必要なパッケージがインストールされていません:")
        for pkg in missing:
            print(f"   - {pkg}")
        print("\n以下のコマンドでインストールしてください:")
        print(f"   pip install {' '.join(missing)}")
        return False
    
    return True


def check_oagi():
    """OAGI SDKを確認"""
    try:
        import oagi
        print("✅ OAGI SDK: インストール済み")
        return True
    except ImportError:
        print("⚠️  OAGI SDK: 未インストール")
        print("   デスクトップ自動化を使用する場合:")
        print("   pip install oagi")
        return False


def check_api_key():
    """OAGI APIキーを確認"""
    api_key = os.environ.get("OAGI_API_KEY")
    if api_key:
        print(f"✅ OAGI API Key: 設定済み ({api_key[:8]}...)")
        return True
    else:
        print("❌ OAGI API Key: 未設定")
        print("   export OAGI_API_KEY='your-api-key'")
        print("   APIキーは https://developer.agiopen.org/ で取得できます")
        return False


def check_permissions():
    """システム権限を確認"""
    system = platform.system()
    print(f"\n📱 プラットフォーム: {system}")
    
    if system == "Darwin":  # macOS
        print("\nmacOS権限チェック:")
        
        # 画面収録
        try:
            import pyautogui
            screenshot = pyautogui.screenshot(region=(0, 0, 1, 1))
            print("✅ 画面収録: 許可済み")
            screen_ok = True
        except Exception as e:
            print("❌ 画面収録: 未許可")
            print("   システム環境設定 → セキュリティとプライバシー → プライバシー → 画面収録")
            screen_ok = False
        
        # アクセシビリティ
        try:
            import Quartz
            trusted = Quartz.AXIsProcessTrusted()
            if trusted:
                print("✅ アクセシビリティ: 許可済み")
            else:
                print("❌ アクセシビリティ: 未許可")
                print("   システム環境設定 → セキュリティとプライバシー → プライバシー → アクセシビリティ")
            accessibility_ok = trusted
        except ImportError:
            print("⚠️  アクセシビリティ: 確認できません（pyobjc-framework-Quartzが必要）")
            accessibility_ok = None
        
        return screen_ok and (accessibility_ok is None or accessibility_ok)
    
    elif system == "Windows":
        print("✅ Windowsでは通常、特別な権限は不要です")
        return True
    
    else:
        print("✅ Linux: X11環境であることを確認してください")
        return True


class LocalAgentClient:
    """ローカルエージェントクライアント"""
    
    def __init__(self, server_url: str, agent_id: str):
        self.server_url = server_url.rstrip("/")
        self.agent_id = agent_id
        self.ws = None
        self.running = False
        self.current_trial_id = None
        self.oagi_available = False
        
        # OAGI SDKの確認
        try:
            from oagi import AsyncDefaultAgent, AsyncPyautoguiActionHandler, AsyncScreenshotMaker
            self.oagi_available = True
        except ImportError:
            pass
    
    def _get_ws_url(self) -> str:
        """WebSocket URLを生成"""
        if self.server_url.startswith("https://"):
            ws_url = self.server_url.replace("https://", "wss://")
        else:
            ws_url = self.server_url.replace("http://", "ws://")
        return f"{ws_url}/api/trial-run/agent/{self.agent_id}"
    
    async def connect(self) -> bool:
        """サーバーに接続"""
        import websockets
        
        ws_url = self._get_ws_url()
        try:
            self.ws = await websockets.connect(ws_url)
            print(f"✅ サーバーに接続しました")
            print(f"   URL: {self.server_url}")
            print(f"   エージェントID: {self.agent_id}")
            self.running = True
            return True
        except Exception as e:
            print(f"❌ 接続エラー: {e}")
            return False
    
    async def send_log(self, trial_id: str, level: str, message: str):
        """ログを送信"""
        if self.ws:
            try:
                await self.ws.send(json.dumps({
                    "type": "log",
                    "trial_id": trial_id,
                    "level": level,
                    "message": message
                }))
            except Exception:
                pass
    
    async def send_screenshot(self, trial_id: str, step: int = 0):
        """スクリーンショットを送信"""
        try:
            import pyautogui
            from PIL import Image
            
            # スクリーンショットを取得
            screenshot = pyautogui.screenshot()
            
            # リサイズ（帯域節約）
            max_width = 1280
            if screenshot.width > max_width:
                ratio = max_width / screenshot.width
                new_size = (max_width, int(screenshot.height * ratio))
                screenshot = screenshot.resize(new_size, Image.Resampling.LANCZOS)
            
            # Base64エンコード
            buffer = io.BytesIO()
            screenshot.save(buffer, format='JPEG', quality=70)
            screenshot_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            if self.ws:
                await self.ws.send(json.dumps({
                    "type": "screenshot",
                    "trial_id": trial_id,
                    "step": step,
                    "data": screenshot_base64
                }))
                
        except Exception as e:
            print(f"⚠️  スクリーンショット送信エラー: {e}")
    
    async def send_step_update(self, trial_id: str, step: int, description: str, status: str = "running"):
        """ステップ更新を送信"""
        if self.ws:
            try:
                await self.ws.send(json.dumps({
                    "type": "step_update",
                    "trial_id": trial_id,
                    "step": step,
                    "description": description,
                    "status": status
                }))
            except Exception:
                pass
    
    async def execute_trial(self, trial_id: str, task_prompt: str, execution_type: str, max_steps: int) -> dict:
        """試運転を実行"""
        self.current_trial_id = trial_id
        
        print(f"\n🚀 試運転開始")
        print(f"   ID: {trial_id}")
        print(f"   タイプ: {execution_type}")
        print(f"   最大ステップ: {max_steps}")
        print(f"   タスク: {task_prompt[:100]}...")
        
        await self.send_log(trial_id, "INFO", "試運転を開始します")
        
        if execution_type == "desktop" and not self.oagi_available:
            error = "OAGI SDKがインストールされていません"
            await self.send_log(trial_id, "ERROR", error)
            return {"success": False, "error": error}
        
        try:
            if execution_type == "web":
                result = await self._execute_web_trial(trial_id, task_prompt, max_steps)
            else:
                result = await self._execute_desktop_trial(trial_id, task_prompt, max_steps)
            
            # 完了を通知
            if result.get("success"):
                if self.ws:
                    await self.ws.send(json.dumps({
                        "type": "trial_completed",
                        "trial_id": trial_id,
                        "result": result.get("result")
                    }))
                print("✅ 試運転完了")
            else:
                if self.ws:
                    await self.ws.send(json.dumps({
                        "type": "trial_failed",
                        "trial_id": trial_id,
                        "error": result.get("error")
                    }))
                print(f"❌ 試運転失敗: {result.get('error')}")
            
            return result
            
        except Exception as e:
            error = str(e)
            if self.ws:
                await self.ws.send(json.dumps({
                    "type": "trial_failed",
                    "trial_id": trial_id,
                    "error": error
                }))
            print(f"❌ 試運転エラー: {error}")
            return {"success": False, "error": error}
        finally:
            self.current_trial_id = None
    
    async def _execute_desktop_trial(self, trial_id: str, task_prompt: str, max_steps: int) -> dict:
        """デスクトップ試運転を実行（Lux使用）"""
        from oagi import AsyncDefaultAgent, AsyncPyautoguiActionHandler, AsyncScreenshotMaker
        
        step_count = 0
        
        # カスタムアクションハンドラー
        class TrackedActionHandler(AsyncPyautoguiActionHandler):
            def __init__(self, client: 'LocalAgentClient', trial_id: str):
                super().__init__()
                self.client = client
                self.trial_id = trial_id
                self.step_count = 0
            
            async def execute(self, action) -> any:
                self.step_count += 1
                
                # ステップ更新
                action_desc = str(action)[:100] if action else "デスクトップ操作"
                await self.client.send_step_update(
                    self.trial_id,
                    self.step_count,
                    action_desc
                )
                
                # スクリーンショット送信
                await self.client.send_screenshot(self.trial_id, self.step_count)
                
                print(f"   ステップ {self.step_count}: {action_desc[:50]}...")
                
                # 実行
                result = await super().execute(action)
                
                # 完了後スクリーンショット
                await asyncio.sleep(0.5)
                await self.client.send_screenshot(self.trial_id, self.step_count)
                
                return result
        
        await self.send_log(trial_id, "INFO", "Luxエージェントを初期化中...")
        
        agent = AsyncDefaultAgent(max_steps=max_steps)
        action_handler = TrackedActionHandler(self, trial_id)
        screenshot_maker = AsyncScreenshotMaker()
        
        # 定期的にスクリーンショットを送信
        async def periodic_screenshot():
            while self.current_trial_id == trial_id:
                await asyncio.sleep(1.0)
                await self.send_screenshot(trial_id, action_handler.step_count)
        
        screenshot_task = asyncio.create_task(periodic_screenshot())
        
        try:
            await self.send_log(trial_id, "INFO", "タスク実行開始")
            
            result = await agent.execute(
                task_prompt,
                action_handler=action_handler,
                image_provider=screenshot_maker
            )
            
            return {
                "success": True,
                "result": str(result) if result else None,
                "total_steps": action_handler.step_count
            }
            
        finally:
            screenshot_task.cancel()
            try:
                await screenshot_task
            except asyncio.CancelledError:
                pass
    
    async def _execute_web_trial(self, trial_id: str, task_prompt: str, max_steps: int) -> dict:
        """Web試運転を実行（Browser Use）"""
        try:
            from browser_use import Agent, BrowserProfile
        except ImportError:
            return {"success": False, "error": "Browser Use がインストールされていません"}
        
        await self.send_log(trial_id, "INFO", "ブラウザを起動中...")
        
        # ブラウザプロファイル
        browser_profile = BrowserProfile(
            headless=False,  # 試運転は画面表示
            disable_security=True
        )
        
        agent = Agent(
            task=task_prompt,
            browser_profile=browser_profile
        )
        
        step_count = 0
        
        async def on_step_start(agent_instance):
            nonlocal step_count
            step_count += 1
            await self.send_step_update(trial_id, step_count, "実行中...", "running")
            await self.send_log(trial_id, "INFO", f"ステップ {step_count} 開始")
        
        async def on_step_end(agent_instance):
            await self.send_step_update(trial_id, step_count, "完了", "completed")
        
        try:
            result = await agent.run(
                max_steps=max_steps,
                on_step_start=on_step_start,
                on_step_end=on_step_end
            )
            
            return {
                "success": True,
                "result": str(result) if result else None,
                "total_steps": step_count
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def listen(self):
        """サーバーからのメッセージを待機"""
        import websockets
        
        print("\n🎧 サーバーからの指示を待機中...")
        print("   Ctrl+C で終了\n")
        print("-" * 50)
        
        try:
            async for message in self.ws:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "trial_execute":
                    # 試運転開始
                    trial_id = data.get("trial_id")
                    task_prompt = data.get("task_prompt", "")
                    execution_type = data.get("execution_type", "desktop")
                    max_steps = data.get("max_steps", 10)
                    
                    # 非同期で実行（他のメッセージも受け取れるように）
                    asyncio.create_task(
                        self.execute_trial(trial_id, task_prompt, execution_type, max_steps)
                    )
                
                elif msg_type == "trial_stop":
                    # 試運転停止
                    trial_id = data.get("trial_id")
                    if self.current_trial_id == trial_id:
                        print(f"\n🛑 試運転 {trial_id} が停止されました")
                        self.current_trial_id = None
                
                elif msg_type == "ping":
                    # ヘルスチェック
                    await self.ws.send(json.dumps({"type": "pong"}))
                    
        except websockets.ConnectionClosed:
            print("\n⚠️  サーバーとの接続が切断されました")
        except Exception as e:
            print(f"\n❌ エラー: {e}")
        finally:
            self.running = False
    
    async def run(self):
        """メインループ"""
        while True:
            if await self.connect():
                await self.listen()
            
            if not self.running:
                break
            
            print("5秒後に再接続を試みます...")
            await asyncio.sleep(5)


def main():
    parser = argparse.ArgumentParser(
        description="Workflow Dashboard - ローカルエージェントクライアント",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
例:
  # ローカルサーバーに接続
  python agent_client.py --server http://localhost:8000
  
  # リモートサーバーに接続
  python agent_client.py --server https://your-server.com
  
  # 権限チェックのみ
  python agent_client.py --check
        """
    )
    parser.add_argument(
        "--server",
        default="http://localhost:8000",
        help="サーバーのURL（デフォルト: http://localhost:8000）"
    )
    parser.add_argument(
        "--agent-id",
        default=None,
        help="エージェントID（指定しない場合は自動生成）"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="権限チェックのみ行う"
    )
    
    args = parser.parse_args()
    
    print_banner()
    
    # 依存パッケージチェック
    print("📦 依存パッケージチェック...")
    if not check_dependencies():
        sys.exit(1)
    
    # OAGIチェック
    check_oagi()
    
    # APIキーチェック
    check_api_key()
    
    # 権限チェック
    check_permissions()
    
    if args.check:
        print("\n✅ チェック完了")
        sys.exit(0)
    
    # エージェントIDの生成
    agent_id = args.agent_id or str(uuid.uuid4())[:8]
    
    print("\n" + "=" * 50)
    print(f"サーバー: {args.server}")
    print(f"エージェントID: {agent_id}")
    print("=" * 50)
    
    # クライアントを実行
    client = LocalAgentClient(args.server, agent_id)
    
    try:
        asyncio.run(client.run())
    except KeyboardInterrupt:
        print("\n\n👋 終了します")


if __name__ == "__main__":
    main()




