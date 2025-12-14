"""Workflow Dashboard - FastAPI メインアプリケーション"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from contextlib import asynccontextmanager
from pathlib import Path
import json
import os

from app.config import settings
from app.database import init_db
from app.routers import tasks, credentials, executions, live_view, websocket, scheduler, wizard, auth, system, trial_run, projects, github_webhook, webhook_triggers
from app.routers import settings as settings_router
from app.utils.logger import logger

# フロントエンド静的ファイルのパス
STATIC_DIR = Path("/app/static")
SERVE_FRONTEND = os.environ.get("SERVE_FRONTEND", "False").lower() == "true"

# デバッグログ関数（本番環境では無効）
def debug_log(location, message, data=None, hypothesis_id=None):
    """開発環境用のデバッグログ（本番では何もしない）"""
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    from app.services.scheduler import scheduler_service
    
    # #region agent log
    debug_log("main.py:lifespan", "Lifespan function started", {"step": "start"}, "A")
    # #endregion
    
    # 起動時
    logger.info("アプリケーションを起動中...")
    
    # #region agent log
    debug_log("main.py:lifespan", "Before database initialization", {}, "C")
    # #endregion
    
    try:
        # データベース初期化
        init_db()
        # #region agent log
        debug_log("main.py:lifespan", "Database initialized successfully", {}, "C")
        # #endregion
        logger.info("データベースを初期化しました")
    except Exception as e:
        # #region agent log
        debug_log("main.py:lifespan", "Database initialization failed", {"error": str(e)}, "C")
        # #endregion
        raise
    
    # #region agent log
    debug_log("main.py:lifespan", "Before directory creation", {}, "A")
    # #endregion
    
    # 必要なディレクトリを作成
    Path("screenshots").mkdir(exist_ok=True)
    Path("uploads").mkdir(exist_ok=True)
    Path("data").mkdir(exist_ok=True)
    
    # #region agent log
    debug_log("main.py:lifespan", "Before scheduler start", {}, "A")
    # #endregion
    
    try:
        # スケジューラーを開始
        scheduler_service.start()
        # #region agent log
        debug_log("main.py:lifespan", "Scheduler started successfully", {}, "A")
        # #endregion
    except Exception as e:
        # #region agent log
        debug_log("main.py:lifespan", "Scheduler start failed", {"error": str(e)}, "A")
        # #endregion
        raise
    
    # #region agent log
    debug_log("main.py:lifespan", "Application startup complete, yielding", {}, "A")
    # #endregion
    
    yield
    
    # 終了時
    logger.info("アプリケーションを終了中...")
    scheduler_service.stop()


# #region agent log
debug_log("main.py", "Before FastAPI app creation", {}, "A")
# #endregion

app = FastAPI(
    title="Workflow Dashboard API",
    description="Browser Useを使った自然言語AIエージェント管理システム",
    version="1.0.0",
    lifespan=lifespan
)

# #region agent log
debug_log("main.py", "FastAPI app created", {"title": app.title}, "A")
# #endregion

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],  # 開発時は全許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイル（スクリーンショット）
screenshots_dir = Path("screenshots")
screenshots_dir.mkdir(exist_ok=True)
app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")

# APIルーター登録
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(tasks.router, prefix=settings.api_prefix)
app.include_router(credentials.router, prefix=settings.api_prefix)
app.include_router(executions.router, prefix=settings.api_prefix)
app.include_router(live_view.router, prefix=settings.api_prefix)
app.include_router(scheduler.router, prefix=settings.api_prefix)
app.include_router(wizard.router, prefix=settings.api_prefix)
app.include_router(settings_router.router, prefix=settings.api_prefix)
app.include_router(system.router, prefix=settings.api_prefix)
app.include_router(projects.router, prefix=settings.api_prefix)
app.include_router(trial_run.router, prefix=settings.api_prefix)
app.include_router(github_webhook.router, prefix=settings.api_prefix)
app.include_router(webhook_triggers.router, prefix=settings.api_prefix)
app.include_router(websocket.router)  # WebSocketはプレフィックスなし
app.include_router(websocket.router, prefix=settings.api_prefix, tags=["screencast"])  # API用


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy"}


# フロントエンド静的ファイルの配信
@app.on_event("startup")
async def setup_frontend():
    """起動時にフロントエンド静的ファイルをマウント"""
    if SERVE_FRONTEND and STATIC_DIR.exists():
        assets_dir = STATIC_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")
            logger.info(f"フロントエンド静的ファイルをマウントしました: {STATIC_DIR}")


@app.get("/")
async def serve_root():
    """ルートエンドポイント"""
    # フロントエンドが有効な場合はindex.htmlを返す
    if SERVE_FRONTEND and STATIC_DIR.exists():
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    
    # APIモードの場合
    return {
        "message": "Workflow Dashboard API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/{full_path:path}")
async def serve_spa_or_404(request: Request, full_path: str):
    """SPAのためのキャッチオールルート"""
    # APIパス、WebSocket、スクリーンショットはスキップ
    if full_path.startswith("api/") or full_path.startswith("ws/") or full_path.startswith("screenshots/") or full_path.startswith("docs") or full_path.startswith("openapi"):
        return {"detail": "Not Found"}
    
    # フロントエンドが有効な場合
    if SERVE_FRONTEND and STATIC_DIR.exists():
        # 静的ファイルが存在する場合はそれを返す
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # それ以外はindex.htmlを返す（SPAルーティング用）
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    
    return {"detail": "Not Found"}


@app.get(f"{settings.api_prefix}/stats")
async def get_stats():
    """ダッシュボード統計情報"""
    from sqlalchemy import func
    from app.database import SessionLocal
    from app.models import Task, Execution
    
    db = SessionLocal()
    try:
        total_tasks = db.query(func.count(Task.id)).scalar()
        active_tasks = db.query(func.count(Task.id)).filter(Task.is_active == True).scalar()
        total_executions = db.query(func.count(Execution.id)).scalar()
        running_executions = db.query(func.count(Execution.id)).filter(
            Execution.status.in_(["running", "pending"])
        ).scalar()
        completed_executions = db.query(func.count(Execution.id)).filter(
            Execution.status == "completed"
        ).scalar()
        failed_executions = db.query(func.count(Execution.id)).filter(
            Execution.status == "failed"
        ).scalar()
        
        # 最近の実行
        recent_executions = db.query(Execution).order_by(
            Execution.started_at.desc()
        ).limit(5).all()
        
        return {
            "tasks": {
                "total": total_tasks,
                "active": active_tasks,
                "inactive": total_tasks - active_tasks
            },
            "executions": {
                "total": total_executions,
                "running": running_executions,
                "completed": completed_executions,
                "failed": failed_executions
            },
            "recent_executions": [
                {
                    "id": e.id,
                    "task_id": e.task_id,
                    "status": e.status,
                    "started_at": e.started_at.isoformat() if e.started_at else None
                }
                for e in recent_executions
            ]
        }
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    import socket
    
    # #region agent log
    debug_log("main.py:__main__", "Starting uvicorn server", {"host": "0.0.0.0", "port": 8000}, "B")
    # #endregion
    
    # ポートが使用可能かチェック
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('127.0.0.1', 8000))
        sock.close()
        if result == 0:
            # #region agent log
            debug_log("main.py:__main__", "Port 8000 is already in use", {}, "E")
            # #endregion
        else:
            # #region agent log
            debug_log("main.py:__main__", "Port 8000 is available", {}, "B")
            # #endregion
    except Exception as e:
        # #region agent log
        debug_log("main.py:__main__", "Port check failed", {"error": str(e)}, "E")
        # #endregion
    
    try:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
        # #region agent log
        debug_log("main.py:__main__", "Uvicorn server started successfully", {}, "B")
        # #endregion
    except Exception as e:
        # #region agent log
        debug_log("main.py:__main__", "Uvicorn server start failed", {"error": str(e)}, "B")
        # #endregion
        raise

