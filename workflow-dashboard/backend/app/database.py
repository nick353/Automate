"""データベース接続とセッション管理"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import json

from app.config import settings

# #region agent log
def debug_log(location, message, data=None, hypothesis_id=None):
    try:
        log_entry = {
            "id": f"log_{int(__import__('time').time() * 1000)}",
            "timestamp": int(__import__('time').time() * 1000),
            "location": location,
            "message": message,
            "data": data or {},
            "sessionId": "debug-session",
            "runId": "run1",
            "hypothesisId": hypothesis_id or "C"
        }
        with open("/Users/nichikatanaka/Desktop/自動化/.cursor/debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
# #endregion

# 実際に使用するデータベースURL
effective_db_url = settings.effective_database_url

# #region agent log
debug_log("database.py", "Database module loading", {"database_url": effective_db_url, "using_supabase": bool(settings.supabase_db_url)}, "C")
# #endregion

# データディレクトリの作成（SQLiteの場合のみ必要）
if effective_db_url.startswith("sqlite"):
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    # #region agent log
    debug_log("database.py", "Data directory created", {"path": str(data_dir.absolute())}, "C")
    # #endregion

# SQLiteの場合はcheck_same_threadをFalseに
connect_args = {}
if effective_db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# PostgreSQLの場合の接続プール設定
pool_settings = {}
if effective_db_url.startswith("postgresql"):
    from sqlalchemy.pool import NullPool
    pool_settings = {"poolclass": NullPool}  # サーバーレス環境向け

# #region agent log
debug_log("database.py", "Before engine creation", {"database_url": effective_db_url[:50] + "...", "connect_args": connect_args}, "C")
# #endregion

try:
    engine = create_engine(
        effective_db_url,
        connect_args=connect_args,
        echo=False,  # デバッグ時はTrueに
        **pool_settings
    )
    # #region agent log
    debug_log("database.py", "Engine created successfully", {}, "C")
    # #endregion
except Exception as e:
    # #region agent log
    debug_log("database.py", "Engine creation failed", {"error": str(e)}, "C")
    # #endregion
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """データベースセッションを取得"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """データベースを初期化（テーブル作成）"""
    # #region agent log
    debug_log("database.py:init_db", "init_db function called", {}, "C")
    # #endregion
    
    try:
        # #region agent log
        debug_log("database.py:init_db", "Before importing models", {}, "C")
        # #endregion
        from app import models  # noqa: F401
        # #region agent log
        debug_log("database.py:init_db", "Models imported successfully", {}, "C")
        # #endregion
    except Exception as e:
        # #region agent log
        debug_log("database.py:init_db", "Model import failed", {"error": str(e)}, "C")
        # #endregion
        raise
    
    try:
        # #region agent log
        debug_log("database.py:init_db", "Before create_all", {}, "C")
        # #endregion
        Base.metadata.create_all(bind=engine)
        # #region agent log
        debug_log("database.py:init_db", "create_all completed successfully", {}, "C")
        # #endregion
    except Exception as e:
        # #region agent log
        debug_log("database.py:init_db", "create_all failed", {"error": str(e)}, "C")
        # #endregion
        raise

