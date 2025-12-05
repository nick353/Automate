# ワークフロー管理ダッシュボード開発指示書（完全版 + ライブビュー）

あなたはフルスタック開発の専門家です。以下の仕様に従って、Browser Useを使った自然言語AIエージェントを管理・可視化するWebダッシュボードシステムを構築してください。

---

## プロジェクト概要

### 目的
自然言語で指示したブラウザ自動化タスクを、Webダッシュボードから管理・監視・実行できるシステムを構築する。**動画をアップロードしてAIに分析させ、チャットでヒアリングしながらタスクを自動生成する機能**も搭載する。**n8nのようにAPIキーやサイトログイン情報を安全に保存・管理し、繰り返し利用できる機能**も実装する。

### 主要機能
1. **動画アップロード + AI分析**（Gemini 1.5 Pro）
2. **AIチャットによるヒアリング**（不明点の確認）
3. **タスク自動生成**（チャット結果からタスク作成）
4. **認証情報管理（Credentials）**
   - APIキーの保存（Anthropic、Google、Slackなど）
   - サイトログイン情報の保存（暗号化）
   - タスク作成時に保存済み認証情報を選択
5. **🆕 ライブビュー機能（Manus同等）**
   - リアルタイムステップ進捗表示
   - スクリーンショットのライブ更新
   - 一時停止・再開・停止コントロール
   - VNC風のブラウザライブビュー
   - ステップごとの所要時間表示
6. タスク一覧表示（ステータス付き）
7. 実行ステータスのリアルタイム表示（成功/失敗/実行中）
8. リアルタイムログ表示
9. タスクの追加・編集・削除（CRUD）
10. 手動実行ボタン
11. スケジュール設定（GUI、cron形式）
12. 実行履歴の閲覧
13. エラー通知設定（Slack/メール）
14. 結果データのダウンロード

### デプロイ先
Hetzner VPS + Coolify（推奨：月額$7〜10）
または Railway / Fly.io / Google Cloud Run

---

## 技術スタック

### バックエンド
- **言語**: Python 3.11+
- **フレームワーク**: FastAPI
- **スケジューラ**: APScheduler
- **WebSocket**: fastapi-websocket
- **DB**: SQLite（SQLAlchemy ORM）→ SaaS展開時はPostgreSQL
- **ブラウザ自動化**: browser-use + langchain-anthropic
- **動画分析**: Google Gemini 1.5 Pro API
- **暗号化**: cryptography (Fernet + PBKDF2)
- **その他**: python-dotenv, aiofiles, google-generativeai

### フロントエンド
- **フレームワーク**: React 18+ (Vite)
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **HTTP通信**: Axios
- **WebSocket**: native WebSocket API
- **UIコンポーネント**: shadcn/ui

### インフラ
- **コンテナ**: Docker + Docker Compose
- **デプロイ**: Hetzner + Coolify（推奨）

---

## ディレクトリ構造

```
workflow-dashboard/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPIエントリーポイント
│   │   ├── config.py            # 設定管理
│   │   ├── database.py          # DB接続・セッション
│   │   ├── models.py            # SQLAlchemyモデル
│   │   ├── schemas.py           # Pydanticスキーマ
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── tasks.py         # タスクCRUD API
│   │   │   ├── executions.py    # 実行履歴API
│   │   │   ├── scheduler.py     # スケジュールAPI
│   │   │   ├── wizard.py        # タスク作成ウィザードAPI
│   │   │   ├── credentials.py   # 認証情報管理API
│   │   │   ├── settings.py      # システム設定API
│   │   │   ├── live_view.py     # 🆕 ライブビューAPI
│   │   │   └── websocket.py     # WebSocket
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── agent.py         # Browser Use実行
│   │   │   ├── scheduler.py     # APSchedulerサービス
│   │   │   ├── notifier.py      # 通知サービス
│   │   │   ├── video_analyzer.py    # 動画分析サービス
│   │   │   ├── wizard_chat.py       # ヒアリングチャットサービス
│   │   │   ├── credential_manager.py  # 認証情報管理サービス
│   │   │   ├── encryption.py        # 暗号化サービス
│   │   │   ├── live_view_manager.py # 🆕 ライブビュー管理
│   │   │   └── browser_controller.py # 🆕 ブラウザ制御（一時停止等）
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── logger.py        # ロギング
│   ├── uploads/                 # アップロードファイル一時保存
│   ├── screenshots/             # 🆕 スクリーンショット保存
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TaskList.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   ├── TaskForm.jsx
│   │   │   ├── ExecutionLog.jsx
│   │   │   ├── ScheduleEditor.jsx
│   │   │   ├── HistoryTable.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── VideoUploader.jsx
│   │   │   ├── WizardChat.jsx
│   │   │   ├── TaskPreview.jsx
│   │   │   ├── CredentialForm.jsx
│   │   │   ├── CredentialList.jsx
│   │   │   ├── CredentialSelector.jsx
│   │   │   │
│   │   │   │   # 🆕 ライブビュー関連
│   │   │   ├── LiveView/
│   │   │   │   ├── index.jsx            # ライブビューメインコンテナ
│   │   │   │   ├── StepProgress.jsx     # ステップ進捗表示
│   │   │   │   ├── ScreenshotViewer.jsx # スクリーンショット表示
│   │   │   │   ├── ControlPanel.jsx     # 一時停止/停止コントロール
│   │   │   │   ├── LogStream.jsx        # リアルタイムログ
│   │   │   │   └── BrowserPreview.jsx   # VNC風ライブビュー
│   │   │   │
│   │   │   └── ExecutionViewer.jsx      # 🆕 実行詳細モーダル
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── TaskWizard.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Credentials.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Execution.jsx            # 🆕 実行詳細ページ
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   ├── useTasks.js
│   │   │   ├── useExecutions.js
│   │   │   ├── useWizardChat.js
│   │   │   ├── useCredentials.js
│   │   │   └── useLiveView.js           # 🆕 ライブビュー用フック
│   │   ├── services/
│   │   │   └── api.js
│   │   └── stores/
│   │       ├── taskStore.js
│   │       ├── wizardStore.js
│   │       ├── credentialStore.js
│   │       └── liveViewStore.js         # 🆕 ライブビュー状態管理
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
└── README.md
```

---

## データベーススキーマ

### execution_steps テーブル（🆕 ライブビュー用）
```sql
CREATE TABLE execution_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL,      -- navigate, click, type, scroll, extract, etc.
    description TEXT,                       -- "ログインボタンをクリック"
    status VARCHAR(20) DEFAULT 'pending',   -- pending, running, completed, failed, skipped
    screenshot_path VARCHAR(255),           -- スクリーンショットのパス
    element_selector TEXT,                  -- 操作対象の要素セレクタ
    input_value TEXT,                       -- 入力値（マスク済み）
    result TEXT,                            -- 実行結果
    error_message TEXT,                     -- エラーメッセージ
    started_at DATETIME,
    completed_at DATETIME,
    duration_ms INTEGER,                    -- 所要時間（ミリ秒）
    FOREIGN KEY (execution_id) REFERENCES executions(id)
);

CREATE INDEX idx_execution_steps_execution_id ON execution_steps(execution_id);
```

### execution_control テーブル（🆕 実行制御用）
```sql
CREATE TABLE execution_control (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'running',   -- running, paused, stopping, stopped
    paused_at DATETIME,
    resumed_at DATETIME,
    stop_requested BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (execution_id) REFERENCES executions(id)
);
```

### executions テーブル（更新）
```sql
CREATE TABLE executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,            -- pending, running, paused, completed, failed, stopped
    started_at DATETIME,
    completed_at DATETIME,
    result TEXT,
    error_message TEXT,
    log_file VARCHAR(255),
    triggered_by VARCHAR(20),               -- manual, schedule, api
    total_steps INTEGER DEFAULT 0,          -- 🆕 総ステップ数
    completed_steps INTEGER DEFAULT 0,      -- 🆕 完了ステップ数
    current_step_id INTEGER,                -- 🆕 現在のステップID
    last_screenshot_path VARCHAR(255),      -- 🆕 最新スクリーンショット
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (current_step_id) REFERENCES execution_steps(id)
);
```

### credentials テーブル
```sql
CREATE TABLE credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    credential_type VARCHAR(50) NOT NULL,
    service_name VARCHAR(100),
    data TEXT NOT NULL,                     -- 暗号化された認証データJSON
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### tasks テーブル
```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_prompt TEXT NOT NULL,
    schedule VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    notify_on_success BOOLEAN DEFAULT FALSE,
    notify_on_failure BOOLEAN DEFAULT TRUE,
    notification_channel VARCHAR(50),
    notification_target VARCHAR(255),
    llm_credential_id INTEGER,
    site_credential_id INTEGER,
    notification_credential_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (llm_credential_id) REFERENCES credentials(id),
    FOREIGN KEY (site_credential_id) REFERENCES credentials(id),
    FOREIGN KEY (notification_credential_id) REFERENCES credentials(id)
);
```

---

## API エンドポイント設計

### Live View API（🆕）
```
GET    /api/executions/{id}/live           # ライブビューデータ取得
GET    /api/executions/{id}/steps          # ステップ一覧取得
GET    /api/executions/{id}/screenshot     # 最新スクリーンショット取得
GET    /api/executions/{id}/screenshots/{step_id}  # 特定ステップのスクリーンショット
POST   /api/executions/{id}/pause          # 一時停止
POST   /api/executions/{id}/resume         # 再開
POST   /api/executions/{id}/stop           # 停止
```

### WebSocket（更新）
```
WS     /ws/executions/{execution_id}       # 実行ログ + ステップ更新のリアルタイム配信
WS     /ws/live/{execution_id}             # 🆕 ライブビュー専用（高頻度更新）
WS     /ws/dashboard                       # ダッシュボード更新通知
WS     /ws/wizard/{session_id}             # ウィザードチャット
```

### Tasks API
```
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/{id}
PUT    /api/tasks/{id}
DELETE /api/tasks/{id}
POST   /api/tasks/{id}/run
POST   /api/tasks/{id}/toggle
```

### Credentials API
```
GET    /api/credentials
POST   /api/credentials
GET    /api/credentials/{id}
PUT    /api/credentials/{id}
DELETE /api/credentials/{id}
POST   /api/credentials/{id}/test
GET    /api/credentials/types
GET    /api/credentials/by-type/{type}
```

### Executions API
```
GET    /api/executions
GET    /api/executions/{id}
GET    /api/executions/{id}/logs
GET    /api/executions/{id}/result/download
DELETE /api/executions/{id}
```

---

## 🆕 ライブビュー機能 詳細仕様

### 概要
Manusのように、実行中のタスクをクリックすると現在の状態をリアルタイムで確認できる機能。

### UI構成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ タスク一覧に戻る     🔄 実行中: 朝の売上チェック        ⏱ 00:02:34     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─── ステップ進捗 ─────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ✅ Step 1: サイトにアクセス                              0.8s       │  │
│  │     └─ https://rms.rakuten.co.jp にアクセスしました                  │  │
│  │                                                                       │  │
│  │  ✅ Step 2: ログインフォームを検出                        1.2s       │  │
│  │     └─ メールアドレス入力欄を発見しました                            │  │
│  │                                                                       │  │
│  │  🔄 Step 3: ログイン情報を入力中...  ← 実行中                        │  │
│  │     └─ パスワードを入力しています                                    │  │
│  │                                                                       │  │
│  │  ⏳ Step 4: ログインボタンをクリック                                 │  │
│  │  ⏳ Step 5: 売上管理メニューに移動                                   │  │
│  │  ⏳ Step 6: データを取得                                             │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─── ブラウザプレビュー ───────────────┐  ┌─── 実行ログ ───────────────┐  │
│  │                                       │  │                           │  │
│  │   📷 リアルタイムスクリーンショット    │  │ 12:03:01 [INFO]           │  │
│  │                                       │  │ ページ読み込み完了         │  │
│  │   ┌─────────────────────────────┐    │  │                           │  │
│  │   │                             │    │  │ 12:03:02 [INFO]           │  │
│  │   │     (ライブ画像)            │    │  │ 要素を検出: #email        │  │
│  │   │                             │    │  │                           │  │
│  │   │     🔴 ライブ               │    │  │ 12:03:03 [INFO]           │  │
│  │   │                             │    │  │ テキスト入力開始          │  │
│  │   └─────────────────────────────┘    │  │                           │  │
│  │                                       │  │ 12:03:04 [DEBUG]          │  │
│  │   [🔍 拡大] [📷 保存]                 │  │ 次のアクションを計画中... │  │
│  │                                       │  │                           │  │
│  └───────────────────────────────────────┘  └───────────────────────────┘  │
│                                                                             │
│  ┌─── コントロール ─────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │   [ ⏸ 一時停止 ]    [ ⏹ 停止 ]    [ 📋 ログをコピー ]              │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### バックエンド実装

#### services/browser_controller.py
```python
import asyncio
from typing import Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
import base64

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
```

#### services/live_view_manager.py
```python
import asyncio
import json
import base64
from datetime import datetime
from typing import Optional
from pathlib import Path
from sqlalchemy.orm import Session

from app.models import Execution, ExecutionStep, ExecutionControl
from app.database import get_db

class LiveViewManager:
    """ライブビューのデータ管理とWebSocket配信"""
    
    def __init__(self):
        self._connections: dict[int, list] = {}  # execution_id -> WebSocket connections
        self._screenshot_cache: dict[int, str] = {}  # execution_id -> base64 screenshot
    
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
        log_message = {
            "type": "log",
            "data": {
                "level": level,
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
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
    
    def get_cached_screenshot(self, execution_id: int) -> Optional[str]:
        """キャッシュされたスクリーンショットを取得"""
        return self._screenshot_cache.get(execution_id)
    
    def cleanup(self, execution_id: int):
        """実行終了時のクリーンアップ"""
        self._connections.pop(execution_id, None)
        self._screenshot_cache.pop(execution_id, None)

# シングルトンインスタンス
live_view_manager = LiveViewManager()
```

#### services/agent.py（更新版 - ライブビュー対応）
```python
import asyncio
import base64
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from browser_use import Agent, Controller, Browser, BrowserConfig
from browser_use.browser.context import BrowserContext
from langchain_anthropic import ChatAnthropic
from sqlalchemy.orm import Session

from app.models import Task, Execution, ExecutionStep, ExecutionControl
from app.database import SessionLocal
from app.services.browser_controller import browser_controller, ExecutionState
from app.services.live_view_manager import live_view_manager
from app.services.credential_manager import CredentialManager

SCREENSHOT_DIR = Path("screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)

class LiveViewAgent:
    """ライブビュー対応のBrowser Useエージェント"""
    
    def __init__(
        self,
        task: Task,
        execution: Execution,
        db: Session,
        credential_manager: CredentialManager
    ):
        self.task = task
        self.execution = execution
        self.db = db
        self.credential_manager = credential_manager
        self.step_count = 0
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.state: Optional[ExecutionState] = None
    
    async def run(self) -> dict:
        """タスクを実行"""
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
            
            # LLM APIキーを取得
            llm_credential = self.credential_manager.get_default(self.db, "api_key")
            if not llm_credential:
                raise ValueError("LLM APIキーが設定されていません")
            
            api_key = llm_credential["data"]["api_key"]
            
            # ブラウザを起動
            self.browser = Browser(
                config=BrowserConfig(
                    headless=True,
                    disable_security=True,
                    extra_chromium_args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu"
                    ]
                )
            )
            
            # LLMを初期化
            llm = ChatAnthropic(
                model="claude-sonnet-4-20250514",
                api_key=api_key
            )
            
            # カスタムコントローラーを作成
            controller = Controller()
            
            # 各アクションの前後にフックを追加
            original_act = controller.act
            
            async def wrapped_act(action, *args, **kwargs):
                # 一時停止チェック
                should_continue = await browser_controller.wait_if_paused(self.execution.id)
                if not should_continue:
                    raise InterruptedError("実行が停止されました")
                
                # ステップ開始を記録
                self.step_count += 1
                step = await self._create_step(
                    step_number=self.step_count,
                    action_type=action.__class__.__name__,
                    description=str(action),
                    status="running"
                )
                
                # ライブビューに通知
                await live_view_manager.send_step_update(
                    execution_id=self.execution.id,
                    step_number=self.step_count,
                    action_type=action.__class__.__name__,
                    description=str(action),
                    status="running"
                )
                
                start_time = datetime.now()
                
                try:
                    # アクションを実行
                    result = await original_act(action, *args, **kwargs)
                    
                    # スクリーンショットを取得
                    screenshot_base64 = await self._take_screenshot(self.step_count)
                    
                    # ステップを完了に更新
                    duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                    await self._update_step(
                        step,
                        status="completed",
                        screenshot_path=f"screenshots/{self.execution.id}/{self.step_count}.png",
                        duration_ms=duration_ms
                    )
                    
                    # ライブビューに通知
                    await live_view_manager.send_step_update(
                        execution_id=self.execution.id,
                        step_number=self.step_count,
                        action_type=action.__class__.__name__,
                        description=str(action),
                        status="completed",
                        screenshot_base64=screenshot_base64,
                        duration_ms=duration_ms
                    )
                    
                    # ログを送信
                    await live_view_manager.send_log(
                        self.execution.id,
                        "INFO",
                        f"Step {self.step_count}: {action.__class__.__name__} 完了"
                    )
                    
                    return result
                    
                except Exception as e:
                    # エラーを記録
                    duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                    await self._update_step(
                        step,
                        status="failed",
                        error_message=str(e),
                        duration_ms=duration_ms
                    )
                    
                    # ライブビューに通知
                    await live_view_manager.send_step_update(
                        execution_id=self.execution.id,
                        step_number=self.step_count,
                        action_type=action.__class__.__name__,
                        description=str(action),
                        status="failed",
                        error_message=str(e),
                        duration_ms=duration_ms
                    )
                    
                    raise
            
            controller.act = wrapped_act
            
            # エージェントを作成・実行
            agent = Agent(
                task=self.task.task_prompt,
                llm=llm,
                controller=controller,
                browser=self.browser
            )
            
            # 実行開始を通知
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                f"タスク開始: {self.task.name}"
            )
            
            result = await agent.run()
            
            # 実行完了を通知
            await live_view_manager.send_log(
                self.execution.id,
                "INFO",
                "タスク完了"
            )
            
            return {
                "success": True,
                "result": result,
                "total_steps": self.step_count
            }
            
        except InterruptedError as e:
            return {
                "success": False,
                "error": str(e),
                "stopped": True,
                "total_steps": self.step_count
            }
        except Exception as e:
            await live_view_manager.send_log(
                self.execution.id,
                "ERROR",
                f"エラー発生: {str(e)}"
            )
            return {
                "success": False,
                "error": str(e),
                "total_steps": self.step_count
            }
        finally:
            # クリーンアップ
            if self.browser:
                await self.browser.close()
            browser_controller.cleanup(self.execution.id)
            live_view_manager.cleanup(self.execution.id)
    
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
        
        return step
    
    async def _update_step(
        self,
        step: ExecutionStep,
        status: str,
        screenshot_path: Optional[str] = None,
        duration_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """ステップを更新"""
        step.status = status
        step.completed_at = datetime.now()
        if screenshot_path:
            step.screenshot_path = screenshot_path
        if duration_ms:
            step.duration_ms = duration_ms
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
            
            # スクリーンショットを取得
            page = await self.browser.get_current_page()
            if not page:
                return None
            
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
            await live_view_manager.send_log(
                self.execution.id,
                "WARNING",
                f"スクリーンショット取得失敗: {str(e)}"
            )
            return None


async def run_task_with_live_view(task_id: int, execution_id: int):
    """ライブビュー対応でタスクを実行（バックグラウンドタスク用）"""
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        execution = db.query(Execution).filter(Execution.id == execution_id).first()
        
        if not task or not execution:
            return
        
        # 実行状態を更新
        execution.status = "running"
        execution.started_at = datetime.now()
        db.commit()
        
        # エージェントを実行
        credential_manager = CredentialManager()
        agent = LiveViewAgent(
            task=task,
            execution=execution,
            db=db,
            credential_manager=credential_manager
        )
        
        result = await agent.run()
        
        # 結果を保存
        if result.get("stopped"):
            execution.status = "stopped"
        elif result.get("success"):
            execution.status = "completed"
            execution.result = str(result.get("result"))
        else:
            execution.status = "failed"
            execution.error_message = result.get("error")
        
        execution.completed_at = datetime.now()
        db.commit()
        
    except Exception as e:
        if execution:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.completed_at = datetime.now()
            db.commit()
    finally:
        db.close()
```

#### routers/live_view.py
```python
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models import Execution, ExecutionStep
from app.services.browser_controller import browser_controller
from app.services.live_view_manager import live_view_manager

router = APIRouter()

@router.get("/executions/{execution_id}/live")
async def get_live_view_data(execution_id: int, db: Session = Depends(get_db)):
    """ライブビューの現在のデータを取得"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    # ステップ一覧を取得
    steps = db.query(ExecutionStep).filter(
        ExecutionStep.execution_id == execution_id
    ).order_by(ExecutionStep.step_number).all()
    
    # 制御状態を取得
    state = browser_controller.get_state(execution_id)
    
    return {
        "execution": {
            "id": execution.id,
            "status": execution.status,
            "started_at": execution.started_at.isoformat() if execution.started_at else None,
            "total_steps": execution.total_steps,
            "completed_steps": execution.completed_steps
        },
        "steps": [
            {
                "step_number": s.step_number,
                "action_type": s.action_type,
                "description": s.description,
                "status": s.status,
                "duration_ms": s.duration_ms,
                "error_message": s.error_message,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None
            }
            for s in steps
        ],
        "control": {
            "is_paused": state.is_paused if state else False,
            "is_stopping": state.is_stopping if state else False
        },
        "screenshot": live_view_manager.get_cached_screenshot(execution_id)
    }

@router.get("/executions/{execution_id}/steps")
async def get_execution_steps(execution_id: int, db: Session = Depends(get_db)):
    """実行のステップ一覧を取得"""
    steps = db.query(ExecutionStep).filter(
        ExecutionStep.execution_id == execution_id
    ).order_by(ExecutionStep.step_number).all()
    
    return [
        {
            "id": s.id,
            "step_number": s.step_number,
            "action_type": s.action_type,
            "description": s.description,
            "status": s.status,
            "screenshot_path": s.screenshot_path,
            "duration_ms": s.duration_ms,
            "error_message": s.error_message,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None
        }
        for s in steps
    ]

@router.get("/executions/{execution_id}/screenshot")
async def get_latest_screenshot(execution_id: int):
    """最新のスクリーンショットを取得"""
    screenshot = live_view_manager.get_cached_screenshot(execution_id)
    if not screenshot:
        raise HTTPException(status_code=404, detail="スクリーンショットがありません")
    
    return {"screenshot": screenshot}

@router.post("/executions/{execution_id}/pause")
async def pause_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行を一時停止"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    if execution.status != "running":
        raise HTTPException(status_code=400, detail="実行中のタスクのみ一時停止できます")
    
    success = await browser_controller.pause(execution_id)
    if not success:
        raise HTTPException(status_code=400, detail="一時停止に失敗しました")
    
    execution.status = "paused"
    db.commit()
    
    return {"message": "一時停止しました", "status": "paused"}

@router.post("/executions/{execution_id}/resume")
async def resume_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行を再開"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    if execution.status != "paused":
        raise HTTPException(status_code=400, detail="一時停止中のタスクのみ再開できます")
    
    success = await browser_controller.resume(execution_id)
    if not success:
        raise HTTPException(status_code=400, detail="再開に失敗しました")
    
    execution.status = "running"
    db.commit()
    
    return {"message": "再開しました", "status": "running"}

@router.post("/executions/{execution_id}/stop")
async def stop_execution(execution_id: int, db: Session = Depends(get_db)):
    """実行を停止"""
    execution = db.query(Execution).filter(Execution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="実行が見つかりません")
    
    if execution.status not in ["running", "paused"]:
        raise HTTPException(status_code=400, detail="実行中または一時停止中のタスクのみ停止できます")
    
    success = await browser_controller.stop(execution_id)
    if not success:
        raise HTTPException(status_code=400, detail="停止に失敗しました")
    
    return {"message": "停止をリクエストしました", "status": "stopping"}


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
```

### フロントエンド実装

#### stores/liveViewStore.js
```javascript
import { create } from 'zustand';

const useLiveViewStore = create((set, get) => ({
  // 状態
  executionId: null,
  status: 'idle', // idle, connecting, connected, disconnected
  controlStatus: 'running', // running, paused, stopping, stopped
  steps: [],
  currentStep: 0,
  totalSteps: 0,
  logs: [],
  screenshot: null,
  elapsedTime: 0,
  error: null,
  
  // WebSocket接続
  ws: null,
  
  // アクション
  connect: (executionId) => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/live/${executionId}`);
    
    ws.onopen = () => {
      set({ status: 'connected', executionId, error: null });
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      
      switch (type) {
        case 'step_update':
          set((state) => {
            const steps = [...state.steps];
            const existingIndex = steps.findIndex(s => s.step_number === data.step_number);
            
            if (existingIndex >= 0) {
              steps[existingIndex] = { ...steps[existingIndex], ...data };
            } else {
              steps.push(data);
            }
            
            return {
              steps: steps.sort((a, b) => a.step_number - b.step_number),
              currentStep: data.status === 'running' ? data.step_number : state.currentStep
            };
          });
          break;
          
        case 'screenshot_update':
          set({ screenshot: data.screenshot });
          break;
          
        case 'log':
          set((state) => ({
            logs: [...state.logs, data].slice(-100) // 最新100件を保持
          }));
          break;
          
        case 'control_update':
          set({ controlStatus: data.status });
          break;
          
        case 'progress_update':
          set({
            currentStep: data.current_step,
            totalSteps: data.total_steps
          });
          break;
      }
    };
    
    ws.onclose = () => {
      set({ status: 'disconnected' });
    };
    
    ws.onerror = (error) => {
      set({ error: 'WebSocket接続エラー', status: 'disconnected' });
    };
    
    set({ ws, status: 'connecting' });
    
    // Ping/Pongで接続維持
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);
    
    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  },
  
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
    set({
      ws: null,
      executionId: null,
      status: 'idle',
      steps: [],
      logs: [],
      screenshot: null
    });
  },
  
  setInitialData: (data) => {
    set({
      steps: data.steps || [],
      controlStatus: data.control?.is_paused ? 'paused' : 'running',
      screenshot: data.screenshot,
      totalSteps: data.execution?.total_steps || 0,
      currentStep: data.execution?.completed_steps || 0
    });
  },
  
  clearLogs: () => set({ logs: [] }),
  
  updateElapsedTime: (time) => set({ elapsedTime: time })
}));

export default useLiveViewStore;
```

#### components/LiveView/index.jsx
```jsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLiveViewStore from '../../stores/liveViewStore';
import api from '../../services/api';
import StepProgress from './StepProgress';
import ScreenshotViewer from './ScreenshotViewer';
import ControlPanel from './ControlPanel';
import LogStream from './LogStream';

export default function LiveView() {
  const { executionId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef(null);
  
  const {
    status,
    controlStatus,
    steps,
    currentStep,
    totalSteps,
    logs,
    screenshot,
    elapsedTime,
    connect,
    disconnect,
    setInitialData,
    updateElapsedTime
  } = useLiveViewStore();
  
  // 初期データの取得とWebSocket接続
  useEffect(() => {
    const init = async () => {
      try {
        // ライブビューデータを取得
        const liveResponse = await api.get(`/executions/${executionId}/live`);
        setInitialData(liveResponse.data);
        
        // タスク情報を取得
        const execResponse = await api.get(`/executions/${executionId}`);
        setTask(execResponse.data.task);
        
        // WebSocket接続
        connect(executionId);
        
        setIsLoading(false);
      } catch (error) {
        console.error('初期化エラー:', error);
        setIsLoading(false);
      }
    };
    
    init();
    
    return () => {
      disconnect();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [executionId]);
  
  // 経過時間タイマー
  useEffect(() => {
    if (controlStatus === 'running') {
      timerRef.current = setInterval(() => {
        updateElapsedTime(elapsedTime + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [controlStatus, elapsedTime]);
  
  // 経過時間のフォーマット
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  // ステータスバッジ
  const getStatusBadge = () => {
    const statusMap = {
      running: { text: '実行中', color: 'bg-blue-500', icon: '🔄' },
      paused: { text: '一時停止', color: 'bg-yellow-500', icon: '⏸' },
      stopping: { text: '停止中...', color: 'bg-orange-500', icon: '⏳' },
      stopped: { text: '停止', color: 'bg-gray-500', icon: '⏹' },
      completed: { text: '完了', color: 'bg-green-500', icon: '✅' },
      failed: { text: '失敗', color: 'bg-red-500', icon: '❌' }
    };
    const s = statusMap[controlStatus] || statusMap.running;
    return (
      <span className={`px-3 py-1 rounded-full text-white text-sm ${s.color}`}>
        {s.icon} {s.text}
      </span>
    );
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tasks')}
              className="text-gray-500 hover:text-gray-700"
            >
              ◀ タスク一覧に戻る
            </button>
            <h1 className="text-xl font-bold">{task?.name || 'タスク実行'}</h1>
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500">⏱ {formatTime(elapsedTime)}</span>
            <span className="text-sm text-gray-400">
              接続: {status === 'connected' ? '🟢' : '🔴'}
            </span>
          </div>
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div className="p-6">
        {/* ステップ進捗 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">ステップ進捗</h2>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            <StepProgress
              steps={steps}
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
          </div>
        </div>
        
        {/* ブラウザプレビュー & ログ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* スクリーンショット */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">ブラウザプレビュー</h2>
              {controlStatus === 'running' && (
                <span className="text-xs text-red-500 animate-pulse">🔴 LIVE</span>
              )}
            </div>
            <div className="p-4">
              <ScreenshotViewer
                screenshot={screenshot}
                executionId={executionId}
              />
            </div>
          </div>
          
          {/* ログストリーム */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold">実行ログ</h2>
            </div>
            <div className="p-4">
              <LogStream logs={logs} />
            </div>
          </div>
        </div>
        
        {/* コントロールパネル */}
        <ControlPanel
          executionId={executionId}
          status={controlStatus}
          logs={logs}
        />
      </div>
    </div>
  );
}
```

#### components/LiveView/StepProgress.jsx
```jsx
export default function StepProgress({ steps, currentStep, totalSteps }) {
  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
        return '🔄';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭';
      default:
        return '⏳';
    }
  };
  
  const getStepColor = (status) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-50';
      case 'running':
        return 'border-blue-500 bg-blue-50 animate-pulse';
      case 'failed':
        return 'border-red-500 bg-red-50';
      case 'skipped':
        return 'border-gray-400 bg-gray-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };
  
  const formatDuration = (ms) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  
  // 未実行ステップのプレースホルダー
  const placeholderSteps = [];
  if (totalSteps > steps.length) {
    for (let i = steps.length + 1; i <= totalSteps; i++) {
      placeholderSteps.push({
        step_number: i,
        status: 'pending',
        description: '実行待ち...'
      });
    }
  }
  
  const allSteps = [...steps, ...placeholderSteps];
  
  if (allSteps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        ステップを待機中...
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {allSteps.map((step) => (
        <div
          key={step.step_number}
          className={`border-l-4 pl-4 py-2 rounded-r ${getStepColor(step.status)}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getStepIcon(step.status)}</span>
              <span className="font-medium">
                Step {step.step_number}: {step.action_type || '処理中'}
              </span>
              {step.status === 'running' && (
                <span className="text-xs text-blue-600">← 実行中</span>
              )}
            </div>
            {step.duration_ms && (
              <span className="text-sm text-gray-500">
                {formatDuration(step.duration_ms)}
              </span>
            )}
          </div>
          
          {step.description && (
            <p className="text-sm text-gray-600 mt-1 ml-7">
              └─ {step.description}
            </p>
          )}
          
          {step.error_message && (
            <p className="text-sm text-red-600 mt-1 ml-7">
              └─ エラー: {step.error_message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### components/LiveView/ScreenshotViewer.jsx
```jsx
import { useState } from 'react';

export default function ScreenshotViewer({ screenshot, executionId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!screenshot) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">📷</div>
          <p>スクリーンショットを待機中...</p>
        </div>
      </div>
    );
  }
  
  const handleSave = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${screenshot}`;
    link.download = `screenshot-${executionId}-${Date.now()}.png`;
    link.click();
  };
  
  return (
    <div>
      <div 
        className="relative cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        <img
          src={`data:image/png;base64,${screenshot}`}
          alt="ブラウザスクリーンショット"
          className="w-full rounded-lg border"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-lg">
            🔍 クリックして拡大
          </span>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex-1 py-2 border rounded hover:bg-gray-50 text-sm"
        >
          🔍 拡大
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-2 border rounded hover:bg-gray-50 text-sm"
        >
          📷 保存
        </button>
      </div>
      
      {/* 拡大モーダル */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="max-w-full max-h-full overflow-auto">
            <img
              src={`data:image/png;base64,${screenshot}`}
              alt="ブラウザスクリーンショット"
              className="max-w-none"
            />
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
```

#### components/LiveView/ControlPanel.jsx
```jsx
import { useState } from 'react';
import api from '../../services/api';

export default function ControlPanel({ executionId, status, logs }) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handlePause = async () => {
    setIsLoading(true);
    try {
      await api.post(`/executions/${executionId}/pause`);
    } catch (error) {
      alert('一時停止に失敗しました: ' + error.message);
    }
    setIsLoading(false);
  };
  
  const handleResume = async () => {
    setIsLoading(true);
    try {
      await api.post(`/executions/${executionId}/resume`);
    } catch (error) {
      alert('再開に失敗しました: ' + error.message);
    }
    setIsLoading(false);
  };
  
  const handleStop = async () => {
    if (!confirm('本当に実行を停止しますか？')) return;
    
    setIsLoading(true);
    try {
      await api.post(`/executions/${executionId}/stop`);
    } catch (error) {
      alert('停止に失敗しました: ' + error.message);
    }
    setIsLoading(false);
  };
  
  const handleCopyLogs = () => {
    const logText = logs.map(l => 
      `[${l.timestamp}] [${l.level}] ${l.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText);
    alert('ログをコピーしました');
  };
  
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const canControl = isRunning || isPaused;
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">コントロール</h2>
        
        <div className="flex gap-3">
          {isRunning && (
            <button
              onClick={handlePause}
              disabled={isLoading}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
            >
              ⏸ 一時停止
            </button>
          )}
          
          {isPaused && (
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              ▶ 再開
            </button>
          )}
          
          {canControl && (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              ⏹ 停止
            </button>
          )}
          
          <button
            onClick={handleCopyLogs}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            📋 ログをコピー
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### components/LiveView/LogStream.jsx
```jsx
import { useEffect, useRef } from 'react';

export default function LogStream({ logs }) {
  const containerRef = useRef(null);
  
  // 自動スクロール
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);
  
  const getLevelColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'ERROR':
        return 'text-red-600';
      case 'WARNING':
        return 'text-yellow-600';
      case 'DEBUG':
        return 'text-gray-400';
      default:
        return 'text-gray-700';
    }
  };
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };
  
  if (logs.length === 0) {
    return (
      <div className="h-64 bg-gray-900 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">ログを待機中...</span>
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className="h-64 bg-gray-900 rounded-lg p-3 overflow-y-auto font-mono text-sm"
    >
      {logs.map((log, index) => (
        <div key={index} className="mb-1">
          <span className="text-gray-500">{formatTime(log.timestamp)}</span>
          <span className={`ml-2 ${getLevelColor(log.level)}`}>
            [{log.level}]
          </span>
          <span className="text-gray-300 ml-2">{log.message}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 実装手順（更新版）

### Phase 1: 基本構造
1. バックエンドのFastAPI基本構造を作成
2. SQLAlchemyモデルとDB接続
3. タスクCRUD APIの実装
4. フロントエンドの基本レイアウト
5. タスク一覧表示

### Phase 2: 認証情報管理
1. 暗号化サービス（encryption.py）
2. 認証情報モデル（Credential）
3. CredentialManager サービス
4. Credentials API（CRUD + テスト）
5. フロントエンド認証情報管理UI

### Phase 3: タスク管理
1. タスク作成・編集フォーム
2. タスクと認証情報の関連付け
3. 有効/無効トグル

### Phase 4: 実行機能 + ライブビュー基盤
1. Browser Useエージェントサービス（LiveViewAgent）
2. BrowserController（一時停止・停止制御）
3. LiveViewManager（WebSocket配信）
4. 実行履歴の保存

### Phase 5: ライブビューUI
1. WebSocketフック（useLiveView）
2. ライブビューストア（liveViewStore）
3. StepProgress コンポーネント
4. ScreenshotViewer コンポーネント
5. ControlPanel コンポーネント
6. LogStream コンポーネント
7. LiveView ページ

### Phase 6: スケジュール機能
1. APSchedulerサービス
2. cron式のパースと登録
3. スケジュールエディタUI

### Phase 7: 動画分析 + ヒアリング機能
1. 動画アップロードAPI
2. Gemini API連携
3. ウィザードセッション管理
4. タスク自動生成

### Phase 8: 通知機能
1. Slack通知サービス
2. メール通知サービス

### Phase 9: デプロイ
1. Dockerfileの最終調整
2. Hetzner VPS + Coolifyセットアップ
3. 環境変数の設定

---

## Dockerfileの注意点

```dockerfile
FROM python:3.11-slim

# Playwrightの依存関係をインストール
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwrightブラウザをインストール
RUN playwright install chromium

COPY . .

# スクリーンショット保存ディレクトリを作成
RUN mkdir -p screenshots uploads

ENV IN_DOCKER=True
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## docker-compose.yml（shm_size設定）

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///./data/workflow.db
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - IN_DOCKER=True
    volumes:
      - ./data:/app/data
      - ./screenshots:/app/screenshots
    shm_size: '1gb'  # 重要: Chromiumのメモリ問題を回避
    init: true       # 重要: ゾンビプロセス防止
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
```

---

## 注意事項

1. **Browser Useはheadless=Trueで動作させる**
2. **shm_size: '1gb'をDocker設定に必ず追加**（Chromiumクラッシュ防止）
3. **init: trueでゾンビプロセスを防止**
4. **SQLiteファイルは永続化ボリュームに保存**
5. **WebSocketは再接続ロジックを必ず実装**
6. **ENCRYPTION_KEYは本番環境で必ずランダムな値に変更**
7. **スクリーンショットは定期的にクリーンアップ**（ディスク容量注意）
8. **ライブビューのWebSocketは高頻度更新になるため、必要に応じてスロットリング**
9. **一時停止中はAPI費用が発生し続けるため、長時間放置に注意**

---

## 月額コスト見積もり（Hetzner + Coolify）

| 項目 | コスト |
|------|--------|
| Hetzner CX32 (8GB RAM) | ~$7.40 |
| Claude API (10タスク/日想定) | ~$10-20 |
| Gemini API (動画分析) | ~$5-10 |
| **合計** | **~$22-37/月** |

Zeaburの$48〜50/月と比較して、約半額で同等以上の機能が実現できます。
