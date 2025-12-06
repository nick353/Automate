"""暗号化サービス"""
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings


class EncryptionService:
    """認証情報の暗号化・復号化を担当"""
    
    def __init__(self, key: str = None):
        self._key = key or settings.encryption_key
        self._fernet = self._create_fernet()
    
    def _create_fernet(self) -> Fernet:
        """Fernetインスタンスを作成"""
        # キーが有効なFernetキーでない場合、PBKDF2で導出
        try:
            return Fernet(self._key.encode())
        except Exception:
            # キーをPBKDF2で導出
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"workflow-dashboard-salt",  # 本番では環境変数に
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(self._key.encode()))
            return Fernet(key)
    
    def encrypt(self, data: dict) -> str:
        """辞書データを暗号化してBase64文字列で返す"""
        json_str = json.dumps(data, ensure_ascii=False)
        encrypted = self._fernet.encrypt(json_str.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_data: str) -> dict:
        """暗号化されたBase64文字列を復号化して辞書で返す"""
        decrypted = self._fernet.decrypt(encrypted_data.encode())
        return json.loads(decrypted.decode())
    
    def mask_sensitive_data(self, data: dict) -> dict:
        """機密データをマスク（表示用）"""
        sensitive_keys = ["api_key", "password", "secret", "token", "webhook_url"]
        masked = {}
        
        for key, value in data.items():
            if any(sk in key.lower() for sk in sensitive_keys):
                if isinstance(value, str) and len(value) > 8:
                    masked[key] = value[:4] + "*" * (len(value) - 8) + value[-4:]
                else:
                    masked[key] = "****"
            else:
                masked[key] = value
        
        return masked


# シングルトンインスタンス
encryption_service = EncryptionService()


