"""
カスタム例外クラス - 詳細なエラー情報を提供
"""
from typing import Optional, Dict, Any


class WorkflowException(Exception):
    """基本例外クラス"""
    
    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        details: Optional[Dict[str, Any]] = None,
        suggestion: Optional[str] = None
    ):
        self.message = message
        self.code = code
        self.details = details or {}
        self.suggestion = suggestion
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "error": self.message,
            "code": self.code,
        }
        if self.details:
            result["details"] = self.details
        if self.suggestion:
            result["suggestion"] = self.suggestion
        return result


class TaskNotFoundError(WorkflowException):
    """タスクが見つからない"""
    
    def __init__(self, task_id: int):
        super().__init__(
            message=f"タスク (ID: {task_id}) が見つかりません",
            code="TASK_NOT_FOUND",
            details={"task_id": task_id},
            suggestion="タスクが削除されたか、IDが正しくない可能性があります。タスク一覧を確認してください。"
        )


class ExecutionNotFoundError(WorkflowException):
    """実行履歴が見つからない"""
    
    def __init__(self, execution_id: int):
        super().__init__(
            message=f"実行履歴 (ID: {execution_id}) が見つかりません",
            code="EXECUTION_NOT_FOUND",
            details={"execution_id": execution_id},
            suggestion="実行履歴が削除されたか、IDが正しくない可能性があります。"
        )


class CredentialNotFoundError(WorkflowException):
    """認証情報が見つからない"""
    
    def __init__(self, credential_name: str):
        super().__init__(
            message=f"必要な認証情報「{credential_name}」が設定されていません",
            code="CREDENTIAL_NOT_FOUND",
            details={"credential_name": credential_name},
            suggestion="設定画面から認証情報を追加してください。"
        )


class ExecutionTimeoutError(WorkflowException):
    """実行タイムアウト"""
    
    def __init__(self, timeout_seconds: int, task_name: str = ""):
        super().__init__(
            message=f"タスクが{timeout_seconds}秒でタイムアウトしました",
            code="EXECUTION_TIMEOUT",
            details={"timeout_seconds": timeout_seconds, "task_name": task_name},
            suggestion="タスクを複数の小さなタスクに分割するか、より具体的な指示に変更してください。"
        )


class BrowserError(WorkflowException):
    """ブラウザ操作エラー"""
    
    def __init__(self, message: str, action: str = ""):
        super().__init__(
            message=f"ブラウザ操作でエラーが発生しました: {message}",
            code="BROWSER_ERROR",
            details={"action": action},
            suggestion="ページが読み込まれているか確認してください。要素が存在しない場合は、タスクの指示を見直してください。"
        )


class AIModelError(WorkflowException):
    """AIモデルエラー"""
    
    def __init__(self, message: str, model: str = ""):
        super().__init__(
            message=f"AIモデルでエラーが発生しました: {message}",
            code="AI_MODEL_ERROR",
            details={"model": model},
            suggestion="APIキーが正しく設定されているか確認してください。また、モデルの利用制限を確認してください。"
        )


class ValidationError(WorkflowException):
    """バリデーションエラー"""
    
    def __init__(self, message: str, field: str = ""):
        super().__init__(
            message=f"入力値が無効です: {message}",
            code="VALIDATION_ERROR",
            details={"field": field},
            suggestion="入力内容を確認して、再度お試しください。"
        )


class RateLimitError(WorkflowException):
    """レート制限エラー"""
    
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message=f"リクエスト制限に達しました。{retry_after}秒後に再試行してください。",
            code="RATE_LIMIT_EXCEEDED",
            details={"retry_after": retry_after},
            suggestion=f"{retry_after}秒待ってから再度お試しください。"
        )


class NetworkError(WorkflowException):
    """ネットワークエラー"""
    
    def __init__(self, message: str, url: str = ""):
        super().__init__(
            message=f"ネットワークエラー: {message}",
            code="NETWORK_ERROR",
            details={"url": url},
            suggestion="インターネット接続を確認してください。対象のサイトがダウンしている可能性もあります。"
        )


# エラーコードから詳細情報を取得するヘルパー
ERROR_MESSAGES = {
    "TASK_NOT_FOUND": {
        "title": "タスクが見つかりません",
        "icon": "search"
    },
    "EXECUTION_NOT_FOUND": {
        "title": "実行履歴が見つかりません",
        "icon": "history"
    },
    "CREDENTIAL_NOT_FOUND": {
        "title": "認証情報が不足しています",
        "icon": "key"
    },
    "EXECUTION_TIMEOUT": {
        "title": "タイムアウト",
        "icon": "clock"
    },
    "BROWSER_ERROR": {
        "title": "ブラウザエラー",
        "icon": "globe"
    },
    "AI_MODEL_ERROR": {
        "title": "AIエラー",
        "icon": "brain"
    },
    "VALIDATION_ERROR": {
        "title": "入力エラー",
        "icon": "alert-circle"
    },
    "RATE_LIMIT_EXCEEDED": {
        "title": "制限超過",
        "icon": "shield"
    },
    "NETWORK_ERROR": {
        "title": "接続エラー",
        "icon": "wifi-off"
    },
    "UNKNOWN_ERROR": {
        "title": "予期せぬエラー",
        "icon": "alert-triangle"
    }
}


def parse_error_message(error: Exception) -> Dict[str, Any]:
    """エラーを解析して詳細情報を返す"""
    if isinstance(error, WorkflowException):
        return error.to_dict()
    
    # 一般的なエラーを解析
    error_str = str(error).lower()
    
    # タイムアウト
    if "timeout" in error_str or "timed out" in error_str:
        return ExecutionTimeoutError(timeout_seconds=600).to_dict()
    
    # ネットワークエラー
    if "connection" in error_str or "network" in error_str or "socket" in error_str:
        return NetworkError(str(error)).to_dict()
    
    # レート制限
    if "rate limit" in error_str or "429" in error_str:
        return RateLimitError().to_dict()
    
    # AIモデルエラー
    if "api" in error_str and ("key" in error_str or "auth" in error_str):
        return AIModelError(str(error)).to_dict()
    
    # デフォルト
    return {
        "error": str(error),
        "code": "UNKNOWN_ERROR",
        "suggestion": "エラーの詳細をログで確認するか、サポートにお問い合わせください。"
    }
