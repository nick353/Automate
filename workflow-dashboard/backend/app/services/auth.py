"""Supabase認証サービス"""
import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel

from app.config import settings


class UserInfo(BaseModel):
    """認証済みユーザー情報"""
    id: str
    email: str
    role: str = "user"


class SupabaseAuth:
    """Supabase認証クラス"""
    
    def __init__(self):
        self._client: Optional[Client] = None
    
    @property
    def client(self) -> Client:
        """Supabaseクライアントを取得（遅延初期化）"""
        if self._client is None:
            supabase_url = getattr(settings, 'supabase_url', None) or os.getenv('SUPABASE_URL')
            supabase_key = getattr(settings, 'supabase_anon_key', None) or os.getenv('SUPABASE_ANON_KEY')
            
            if not supabase_url or not supabase_key:
                raise ValueError(
                    "Supabase設定が見つかりません。"
                    "SUPABASE_URLとSUPABASE_ANON_KEY環境変数を設定してください。"
                )
            
            self._client = create_client(supabase_url, supabase_key)
        
        return self._client
    
    def is_configured(self) -> bool:
        """Supabaseが設定されているかチェック"""
        supabase_url = getattr(settings, 'supabase_url', None) or os.getenv('SUPABASE_URL')
        supabase_key = getattr(settings, 'supabase_anon_key', None) or os.getenv('SUPABASE_ANON_KEY')
        return bool(supabase_url and supabase_key)
    
    async def verify_token(self, token: str) -> Optional[UserInfo]:
        """JWTトークンを検証してユーザー情報を返す"""
        try:
            # Supabaseでトークンを検証
            response = self.client.auth.get_user(token)
            
            if response and response.user:
                return UserInfo(
                    id=response.user.id,
                    email=response.user.email or "",
                    role=response.user.role or "user"
                )
            
            return None
            
        except Exception as e:
            print(f"Token verification error: {e}")
            return None
    
    async def sign_up(self, email: str, password: str) -> dict:
        """新規ユーザー登録"""
        try:
            response = self.client.auth.sign_up({
                "email": email,
                "password": password
            })
            
            if response.user:
                return {
                    "success": True,
                    "user_id": response.user.id,
                    "email": response.user.email,
                    "message": "確認メールを送信しました"
                }
            
            return {"success": False, "message": "登録に失敗しました"}
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    async def sign_in(self, email: str, password: str) -> dict:
        """ログイン"""
        try:
            response = self.client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user and response.session:
                return {
                    "success": True,
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email
                    },
                    "session": {
                        "access_token": response.session.access_token,
                        "refresh_token": response.session.refresh_token,
                        "expires_at": response.session.expires_at
                    }
                }
            
            return {"success": False, "message": "ログインに失敗しました"}
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    async def sign_out(self, token: str) -> dict:
        """ログアウト"""
        try:
            self.client.auth.sign_out()
            return {"success": True, "message": "ログアウトしました"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    async def refresh_session(self, refresh_token: str) -> dict:
        """セッションをリフレッシュ"""
        try:
            response = self.client.auth.refresh_session(refresh_token)
            
            if response.session:
                return {
                    "success": True,
                    "session": {
                        "access_token": response.session.access_token,
                        "refresh_token": response.session.refresh_token,
                        "expires_at": response.session.expires_at
                    }
                }
            
            return {"success": False, "message": "リフレッシュに失敗しました"}
            
        except Exception as e:
            return {"success": False, "message": str(e)}


# シングルトンインスタンス
supabase_auth = SupabaseAuth()

# HTTPベアラー認証スキーム
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserInfo]:
    """現在のユーザーを取得（オプショナル）"""
    # Supabaseが設定されていない場合はスキップ
    if not supabase_auth.is_configured():
        return None
    
    if not credentials:
        return None
    
    user = await supabase_auth.verify_token(credentials.credentials)
    return user


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> UserInfo:
    """認証を必須にする依存関係"""
    # Supabaseが設定されていない場合はダミーユーザーを返す（開発用）
    if not supabase_auth.is_configured():
        return UserInfo(id="local-dev", email="dev@localhost", role="admin")
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証が必要です",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user = await supabase_auth.verify_token(credentials.credentials)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なトークンです",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return user



