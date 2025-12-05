"""認証 API"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
import json

from app.services.auth import supabase_auth, require_auth, UserInfo

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
            "hypothesisId": hypothesis_id or "F"
        }
        with open("/Users/nichikatanaka/Desktop/自動化/.cursor/debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
# #endregion

router = APIRouter(prefix="/auth", tags=["auth"])


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.get("/status")
async def auth_status():
    """認証システムの状態を確認"""
    # #region agent log
    debug_log("auth.py:auth_status", "Auth status endpoint called", {}, "F")
    # #endregion
    
    import os
    # 開発モードをオーバーライド可能に
    dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
    
    # #region agent log
    debug_log("auth.py:auth_status", "Before checking supabase config", {"dev_mode": dev_mode}, "F")
    # #endregion
    
    is_configured = supabase_auth.is_configured()
    
    # #region agent log
    debug_log("auth.py:auth_status", "Supabase config check result", {"is_configured": is_configured}, "F")
    # #endregion
    
    result = {
        "auth_enabled": is_configured and not dev_mode,
        "provider": "supabase" if is_configured else "none",
        "dev_mode": dev_mode
    }
    
    # #region agent log
    debug_log("auth.py:auth_status", "Auth status response", result, "F")
    # #endregion
    
    return result


@router.post("/signup")
async def sign_up(request: SignUpRequest):
    """新規ユーザー登録"""
    if not supabase_auth.is_configured():
        raise HTTPException(status_code=503, detail="認証システムが設定されていません")
    
    result = await supabase_auth.sign_up(request.email, request.password)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/signin")
async def sign_in(request: SignInRequest):
    """ログイン"""
    if not supabase_auth.is_configured():
        # 開発モード：認証なしでダミートークンを返す
        return {
            "success": True,
            "user": {"id": "local-dev", "email": request.email},
            "session": {
                "access_token": "dev-token",
                "refresh_token": "dev-refresh",
                "expires_at": None
            },
            "dev_mode": True
        }
    
    result = await supabase_auth.sign_in(request.email, request.password)
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["message"])
    
    return result


@router.post("/signout")
async def sign_out(user: UserInfo = Depends(require_auth)):
    """ログアウト"""
    if not supabase_auth.is_configured():
        return {"success": True, "message": "ログアウトしました（開発モード）"}
    
    result = await supabase_auth.sign_out("")
    return result


@router.post("/refresh")
async def refresh_session(request: RefreshRequest):
    """セッションをリフレッシュ"""
    if not supabase_auth.is_configured():
        return {
            "success": True,
            "session": {
                "access_token": "dev-token",
                "refresh_token": "dev-refresh",
                "expires_at": None
            },
            "dev_mode": True
        }
    
    result = await supabase_auth.refresh_session(request.refresh_token)
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["message"])
    
    return result


@router.get("/me")
async def get_me(user: UserInfo = Depends(require_auth)):
    """現在のユーザー情報を取得"""
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role
    }

