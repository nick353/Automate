"""認証情報管理 API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    CredentialCreate, CredentialUpdate, CredentialResponse,
    MessageResponse, CREDENTIAL_TYPES
)
from app.services.credential_manager import credential_manager
from app.services.encryption import encryption_service
from app.services.auth import get_current_user, UserInfo

router = APIRouter(prefix="/credentials", tags=["credentials"])


def get_user_id(user: Optional[UserInfo]) -> Optional[str]:
    """ユーザーIDを取得（開発モード対応）"""
    if user and user.id != "local-dev":
        return user.id
    return None


def _credential_status_payload(db: Session, user_id: Optional[str]):
    """主要サービスの認証情報ステータスを返す"""
    services = ["openai", "anthropic", "google", "serper", "oagi", "browser_use"]
    present = []
    missing = []
    details = []
    
    for service in services:
        cred = credential_manager.get_default(db, "api_key", service, user_id)
        has_key = bool(cred)
        details.append({"service": service, "has_key": has_key})
        if has_key:
            present.append(service)
        else:
            missing.append(service)
    
    return {
        "present": present,
        "missing": missing,
        "details": details
    }


@router.get("", response_model=List[CredentialResponse])
async def get_credentials(
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報一覧を取得（ユーザーに紐づくもののみ）"""
    user_id = get_user_id(current_user)
    return credential_manager.get_all(db, user_id=user_id)


@router.post("", response_model=CredentialResponse)
async def create_credential(
    credential: CredentialCreate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報を作成（ユーザーIDを保存）"""
    user_id = get_user_id(current_user)
    return credential_manager.create(db, credential, user_id=user_id)


@router.get("/types")
def get_credential_types():
    """認証情報タイプ一覧を取得"""
    return CREDENTIAL_TYPES


@router.get("/by-type/{credential_type}", response_model=List[CredentialResponse])
async def get_credentials_by_type(
    credential_type: str,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """タイプ別に認証情報を取得（ユーザーに紐づくもののみ）"""
    user_id = get_user_id(current_user)
    return credential_manager.get_by_type(db, credential_type, user_id=user_id)


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報を取得（データは暗号化されたまま）"""
    user_id = get_user_id(current_user)
    credential = credential_manager.get(db, credential_id, user_id=user_id)
    if not credential:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    return credential


@router.get("/{credential_id}/data")
async def get_credential_with_data(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報を復号化データ付きで取得（マスク済み）"""
    user_id = get_user_id(current_user)
    credential = credential_manager.get_with_data(db, credential_id, user_id=user_id)
    if not credential:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    
    # 機密データをマスク
    credential["data"] = encryption_service.mask_sensitive_data(credential["data"])
    return credential


@router.put("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: int,
    credential_update: CredentialUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報を更新"""
    user_id = get_user_id(current_user)
    credential = credential_manager.update(db, credential_id, credential_update, user_id=user_id)
    if not credential:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    return credential


@router.delete("/{credential_id}", response_model=MessageResponse)
async def delete_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報を削除"""
    user_id = get_user_id(current_user)
    success = credential_manager.delete(db, credential_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    return {"message": "認証情報を削除しました"}


@router.post("/{credential_id}/test")
async def test_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """認証情報をテスト"""
    try:
        user_id = get_user_id(current_user)
        result = credential_manager.test_credential(db, credential_id, user_id=user_id)
        return result
    except Exception as e:
        import traceback
        from app.utils.logger import logger
        logger.error(f"認証情報テストエラー (credential_id={credential_id}): {str(e)}")
        logger.error(traceback.format_exc())
        return {"success": False, "message": f"テスト実行中にエラーが発生しました: {str(e)}"}


@router.get("/status")
async def get_credential_status(
    db: Session = Depends(get_db),
    current_user: Optional[UserInfo] = Depends(get_current_user)
):
    """
    主要サービスの認証情報ステータスを取得。
    失敗時も200で空ステータスを返し、フロントの描画を止めない。
    """
    user_id = get_user_id(current_user)
    try:
        return _credential_status_payload(db, user_id)
    except Exception as e:
        # 例外時は空のステータスを返してUIを壊さない
        from app.utils.logger import logger
        logger.warning(f"credential status fallback: {e}")
        return {
            "present": [],
            "missing": ["openai", "anthropic", "google", "serper", "oagi", "browser_use"],
            "details": [
                {"service": svc, "has_key": False}
                for svc in ["openai", "anthropic", "google", "serper", "oagi", "browser_use"]
            ]
        }

