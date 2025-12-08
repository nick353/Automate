"""
認証情報マネージャー

各種APIキー・ログイン情報を安全に管理するサービス。
暗号化して保存し、必要に応じて復号化して取得します。
"""

import os
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import Credential
from app.services.encryption import encryption_service
from app.utils.logger import logger


class CredentialManager:
    """認証情報の管理を担当"""
    
    def __init__(self):
        self._encryption = encryption_service
    
    def get_all(self, db: Session, user_id: str = None) -> List[Dict]:
        """すべての認証情報を取得（データは含まない）"""
        query = db.query(Credential)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        credentials = query.order_by(Credential.created_at.desc()).all()
        return [self._to_response(c) for c in credentials]
    
    def get(self, db: Session, credential_id: int, user_id: str = None) -> Optional[Dict]:
        """認証情報を取得（データは含まない）"""
        query = db.query(Credential).filter(Credential.id == credential_id)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        credential = query.first()
        if not credential:
            return None
        return self._to_response(credential)
    
    def get_with_data(self, db: Session, credential_id: int, user_id: str = None) -> Optional[Dict]:
        """認証情報をデータ付きで取得（復号化済み）"""
        query = db.query(Credential).filter(Credential.id == credential_id)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        credential = query.first()
        if not credential:
            return None
        
        try:
            decrypted_data = self._encryption.decrypt(credential.data)
        except Exception as e:
            logger.error(f"認証情報の復号化に失敗: {e}")
            decrypted_data = {}
        
        return {
            **self._to_response(credential),
            "data": decrypted_data
        }
    
    def get_by_type(self, db: Session, credential_type: str, user_id: str = None) -> List[Dict]:
        """タイプで認証情報を取得"""
        query = db.query(Credential).filter(Credential.credential_type == credential_type)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        credentials = query.all()
        return [self._to_response(c) for c in credentials]
    
    def get_default(self, db: Session, credential_type: str, service_name: str = None, user_id: str = None) -> Optional[Dict]:
        """デフォルトの認証情報を取得（復号化済み）
        
        優先順位:
        1. is_default=True のもの
        2. 環境変数
        3. 最初に見つかったもの
        """
        query = db.query(Credential).filter(Credential.credential_type == credential_type)
        
        if service_name:
            query = query.filter(Credential.service_name == service_name)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        # デフォルト設定されているものを優先
        credential = query.filter(Credential.is_default == True).first()
        
        # なければ最初のものを取得
        if not credential:
            credential = query.first()
        
        # DBにない場合は環境変数をチェック
        if not credential:
            env_key = self._get_env_key(credential_type, service_name)
            if env_key:
                return {
                    "id": None,
                    "name": f"{service_name or credential_type} (環境変数)",
                    "credential_type": credential_type,
                    "service_name": service_name,
                    "data": {"api_key": env_key},
                    "is_default": True,
                    "source": "env"
                }
            return None
        
        try:
            decrypted_data = self._encryption.decrypt(credential.data)
        except Exception as e:
            logger.error(f"認証情報の復号化に失敗: {e}")
            return None
        
        return {
            **self._to_response(credential),
            "data": decrypted_data
        }
    
    def _get_env_key(self, credential_type: str, service_name: str = None) -> Optional[str]:
        """環境変数からAPIキーを取得"""
        env_mapping = {
            ("api_key", "anthropic"): "ANTHROPIC_API_KEY",
            ("api_key", "google"): "GOOGLE_API_KEY",
            ("api_key", "openai"): "OPENAI_API_KEY",
            ("api_key", "oagi"): "OAGI_API_KEY",
        }
        
        key = (credential_type, service_name)
        env_name = env_mapping.get(key)
        
        if env_name:
            return os.environ.get(env_name)
        return None
    
    def create(self, db: Session, credential_data: Any, user_id: str = None) -> Dict:
        """認証情報を作成"""
        # dataフィールドを暗号化
        encrypted_data = self._encryption.encrypt(credential_data.data)
        
        # デフォルトを設定する場合、同じタイプ・サービスの他のデフォルトを解除
        if credential_data.is_default:
            self._clear_defaults(
                db, 
                credential_data.credential_type, 
                credential_data.service_name,
                user_id
            )
        
        credential = Credential(
            user_id=user_id,
            name=credential_data.name,
            credential_type=credential_data.credential_type,
            service_name=credential_data.service_name,
            description=credential_data.description,
            is_default=credential_data.is_default,
            data=encrypted_data
        )
        
        db.add(credential)
        db.commit()
        db.refresh(credential)
        
        logger.info(f"認証情報を作成: {credential.name} ({credential.service_name})")
        return self._to_response(credential)
    
    def update(self, db: Session, credential_id: int, credential_data: Any, user_id: str = None) -> Optional[Dict]:
        """認証情報を更新"""
        query = db.query(Credential).filter(Credential.id == credential_id)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        credential = query.first()
        if not credential:
            return None
        
        # 更新するフィールドを処理
        update_dict = credential_data.model_dump(exclude_unset=True)
        
        # dataフィールドがある場合は暗号化
        if "data" in update_dict and update_dict["data"]:
            update_dict["data"] = self._encryption.encrypt(update_dict["data"])
        
        # デフォルトを設定する場合、同じタイプ・サービスの他のデフォルトを解除
        if update_dict.get("is_default"):
            self._clear_defaults(
                db,
                credential.credential_type,
                credential.service_name,
                credential.user_id,
                exclude_id=credential_id
            )
        
        for key, value in update_dict.items():
            if value is not None:
                setattr(credential, key, value)
        
        db.commit()
        db.refresh(credential)
        
        logger.info(f"認証情報を更新: {credential.name}")
        return self._to_response(credential)
    
    def delete(self, db: Session, credential_id: int, user_id: str = None) -> bool:
        """認証情報を削除"""
        query = db.query(Credential).filter(Credential.id == credential_id)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        
        credential = query.first()
        if not credential:
            return False
        
        logger.info(f"認証情報を削除: {credential.name}")
        db.delete(credential)
        db.commit()
        return True
    
    def test_credential(self, db: Session, credential_id: int, user_id: str = None) -> Dict:
        """認証情報をテスト"""
        credential = self.get_with_data(db, credential_id, user_id=user_id)
        if not credential:
            return {"success": False, "error": "認証情報が見つかりません"}
        
        service_name = credential.get("service_name")
        cred_type = credential.get("credential_type")
        data = credential.get("data", {})
        
        try:
            if cred_type == "api_key":
                return self._test_api_key(service_name, data)
            elif cred_type == "login":
                return {"success": True, "message": "ログイン情報の形式は正しいです"}
            elif cred_type == "webhook":
                return self._test_webhook(service_name, data)
            else:
                return {"success": True, "message": "形式は正しいです"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _test_api_key(self, service_name: str, data: dict) -> Dict:
        """APIキーをテスト"""
        api_key = data.get("api_key", "")
        
        if not api_key:
            return {"success": False, "error": "APIキーが空です"}
        
        if service_name == "anthropic":
            if not api_key.startswith("sk-ant-"):
                return {"success": False, "error": "Anthropic APIキーの形式が不正です（sk-ant-で始まる必要があります）"}
            return {"success": True, "message": "APIキーの形式は正しいです"}
        
        elif service_name == "openai":
            if not api_key.startswith("sk-"):
                return {"success": False, "error": "OpenAI APIキーの形式が不正です（sk-で始まる必要があります）"}
            return {"success": True, "message": "APIキーの形式は正しいです"}
        
        elif service_name == "google":
            if len(api_key) < 30:
                return {"success": False, "error": "Google APIキーが短すぎます"}
            return {"success": True, "message": "APIキーの形式は正しいです"}
        
        elif service_name == "oagi":
            # OAGIのAPIキー形式をチェック
            if len(api_key) < 20:
                return {"success": False, "error": "OAGI APIキーが短すぎます"}
            return {"success": True, "message": "APIキーの形式は正しいです"}
        
        return {"success": True, "message": "APIキーが設定されています"}
    
    def _test_webhook(self, service_name: str, data: dict) -> Dict:
        """Webhookをテスト"""
        webhook_url = data.get("webhook_url", "")
        
        if not webhook_url:
            return {"success": False, "error": "Webhook URLが空です"}
        
        if service_name == "slack":
            if not webhook_url.startswith("https://hooks.slack.com/"):
                return {"success": False, "error": "Slack Webhook URLの形式が不正です"}
        
        elif service_name == "discord":
            if not webhook_url.startswith("https://discord.com/api/webhooks/"):
                return {"success": False, "error": "Discord Webhook URLの形式が不正です"}
        
        return {"success": True, "message": "Webhook URLの形式は正しいです"}
    
    def _clear_defaults(self, db: Session, credential_type: str, service_name: str, user_id: str = None, exclude_id: int = None):
        """同じタイプ・サービスのデフォルト設定を解除"""
        query = db.query(Credential).filter(
            Credential.credential_type == credential_type,
            Credential.is_default == True
        )
        
        if service_name:
            query = query.filter(Credential.service_name == service_name)
        if user_id:
            query = query.filter(Credential.user_id == user_id)
        if exclude_id:
            query = query.filter(Credential.id != exclude_id)
        
        for credential in query.all():
            credential.is_default = False
        
        db.commit()
    
    def _to_response(self, credential: Credential) -> Dict:
        """Credentialモデルをレスポンス用辞書に変換"""
        return {
            "id": credential.id,
            "name": credential.name,
            "credential_type": credential.credential_type,
            "service_name": credential.service_name,
            "description": credential.description,
            "is_default": credential.is_default,
            "created_at": credential.created_at,
            "updated_at": credential.updated_at
        }


# シングルトンインスタンス
credential_manager = CredentialManager()
