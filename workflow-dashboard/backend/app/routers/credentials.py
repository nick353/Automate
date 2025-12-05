"""認証情報管理 API"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    CredentialCreate, CredentialUpdate, CredentialResponse,
    MessageResponse, CREDENTIAL_TYPES
)
from app.services.credential_manager import credential_manager
from app.services.encryption import encryption_service

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("", response_model=List[CredentialResponse])
def get_credentials(db: Session = Depends(get_db)):
    """認証情報一覧を取得"""
    return credential_manager.get_all(db)


@router.post("", response_model=CredentialResponse)
def create_credential(credential: CredentialCreate, db: Session = Depends(get_db)):
    """認証情報を作成"""
    return credential_manager.create(db, credential)


@router.get("/types")
def get_credential_types():
    """認証情報タイプ一覧を取得"""
    return CREDENTIAL_TYPES


@router.get("/by-type/{credential_type}", response_model=List[CredentialResponse])
def get_credentials_by_type(credential_type: str, db: Session = Depends(get_db)):
    """タイプ別に認証情報を取得"""
    return credential_manager.get_by_type(db, credential_type)


@router.get("/{credential_id}", response_model=CredentialResponse)
def get_credential(credential_id: int, db: Session = Depends(get_db)):
    """認証情報を取得（データは暗号化されたまま）"""
    credential = credential_manager.get(db, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    return credential


@router.get("/{credential_id}/data")
def get_credential_with_data(credential_id: int, db: Session = Depends(get_db)):
    """認証情報を復号化データ付きで取得（マスク済み）"""
    credential = credential_manager.get_with_data(db, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    
    # 機密データをマスク
    credential["data"] = encryption_service.mask_sensitive_data(credential["data"])
    return credential


@router.put("/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: int,
    credential_update: CredentialUpdate,
    db: Session = Depends(get_db)
):
    """認証情報を更新"""
    credential = credential_manager.update(db, credential_id, credential_update)
    if not credential:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    return credential


@router.delete("/{credential_id}", response_model=MessageResponse)
def delete_credential(credential_id: int, db: Session = Depends(get_db)):
    """認証情報を削除"""
    success = credential_manager.delete(db, credential_id)
    if not success:
        raise HTTPException(status_code=404, detail="認証情報が見つかりません")
    return {"message": "認証情報を削除しました"}


@router.post("/{credential_id}/test")
def test_credential(credential_id: int, db: Session = Depends(get_db)):
    """認証情報をテスト"""
    try:
        result = credential_manager.test_credential(db, credential_id)
        return result
    except Exception as e:
        import traceback
        from app.utils.logger import logger
        logger.error(f"認証情報テストエラー (credential_id={credential_id}): {str(e)}")
        logger.error(traceback.format_exc())
        return {"success": False, "message": f"テスト実行中にエラーが発生しました: {str(e)}"}

