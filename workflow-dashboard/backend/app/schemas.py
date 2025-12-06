"""Pydantic スキーマ定義"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


# ==================== Credential Schemas ====================

class CredentialBase(BaseModel):
    name: str
    credential_type: str  # api_key, login, webhook
    service_name: Optional[str] = None
    description: Optional[str] = None
    is_default: bool = False


class CredentialCreate(CredentialBase):
    data: dict  # 暗号化前の認証データ


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    credential_type: Optional[str] = None
    service_name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    data: Optional[dict] = None


class CredentialResponse(CredentialBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CredentialWithData(CredentialResponse):
    """データを含むレスポンス（復号化済み）"""
    data: dict


# ==================== Task Schemas ====================

class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    task_prompt: str
    schedule: Optional[str] = None
    is_active: bool = True
    notify_on_success: bool = False
    notify_on_failure: bool = True
    notification_channel: Optional[str] = None
    notification_target: Optional[str] = None
    llm_credential_id: Optional[int] = None
    site_credential_id: Optional[int] = None
    notification_credential_id: Optional[int] = None
    # 実行タイプ: web (Browser Use), desktop (Lux), hybrid (両方)
    execution_type: str = "web"
    max_steps: int = 20
    lux_credential_id: Optional[int] = None  # Lux (OAGI) API Key
    # 実行場所: server (サーバーで実行), local (ローカルエージェント経由)
    execution_location: str = "server"


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    task_prompt: Optional[str] = None
    schedule: Optional[str] = None
    is_active: Optional[bool] = None
    notify_on_success: Optional[bool] = None
    notify_on_failure: Optional[bool] = None
    notification_channel: Optional[str] = None
    notification_target: Optional[str] = None
    llm_credential_id: Optional[int] = None
    site_credential_id: Optional[int] = None
    notification_credential_id: Optional[int] = None
    execution_type: Optional[str] = None
    max_steps: Optional[int] = None
    lux_credential_id: Optional[int] = None
    execution_location: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskWithCredentials(TaskResponse):
    """認証情報を含むレスポンス"""
    llm_credential: Optional[CredentialResponse] = None
    site_credential: Optional[CredentialResponse] = None
    notification_credential: Optional[CredentialResponse] = None
    lux_credential: Optional[CredentialResponse] = None


# ==================== Execution Schemas ====================

class ExecutionStepResponse(BaseModel):
    id: int
    step_number: int
    action_type: str
    description: Optional[str] = None
    status: str
    screenshot_path: Optional[str] = None
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecutionBase(BaseModel):
    task_id: int
    triggered_by: str = "manual"


class ExecutionCreate(ExecutionBase):
    pass


class ExecutionResponse(BaseModel):
    id: int
    task_id: int
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[str] = None
    error_message: Optional[str] = None
    triggered_by: Optional[str] = None
    total_steps: int = 0
    completed_steps: int = 0
    last_screenshot_path: Optional[str] = None

    class Config:
        from_attributes = True


class ExecutionWithTask(ExecutionResponse):
    """タスク情報を含むレスポンス"""
    task: TaskResponse


class ExecutionWithSteps(ExecutionResponse):
    """ステップを含むレスポンス"""
    steps: List[ExecutionStepResponse] = []


# ==================== Live View Schemas ====================

class LiveViewData(BaseModel):
    execution: ExecutionResponse
    steps: List[ExecutionStepResponse]
    control: dict
    screenshot: Optional[str] = None


class ControlStatusUpdate(BaseModel):
    status: str
    timestamp: datetime


# ==================== Wizard Schemas ====================

class VideoUploadResponse(BaseModel):
    session_id: str
    message: str


class VideoAnalysisResponse(BaseModel):
    session_id: str
    analysis: str
    suggested_task: Optional[str] = None


class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    suggested_task: Optional[str] = None


class GeneratedTaskResponse(BaseModel):
    task_prompt: str
    task_name: str
    task_description: str


# ==================== Settings Schemas ====================

class NotificationSettings(BaseModel):
    slack_enabled: bool = False
    email_enabled: bool = False
    default_channel: Optional[str] = None


class SystemSettings(BaseModel):
    notifications: NotificationSettings
    default_llm_credential_id: Optional[int] = None


# ==================== Common Schemas ====================

class MessageResponse(BaseModel):
    message: str
    status: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str


# ==================== Credential Types ====================

CREDENTIAL_TYPES = [
    {"type": "api_key", "label": "APIキー", "services": ["anthropic", "google", "openai", "oagi"]},
    {"type": "login", "label": "サイトログイン", "services": ["custom"]},
    {"type": "webhook", "label": "Webhook", "services": ["slack", "discord"]},
    {"type": "smtp", "label": "SMTP設定", "services": ["email"]},
]

# 実行タイプの定義
EXECUTION_TYPES = [
    {"type": "web", "label": "Webブラウザ (Browser Use)", "description": "ブラウザ自動化のみ"},
    {"type": "desktop", "label": "デスクトップ (Lux)", "description": "PC全体の自動操作"},
    {"type": "hybrid", "label": "ハイブリッド", "description": "WebとデスクトップのMIX"},
]

# 実行場所の定義
EXECUTION_LOCATIONS = [
    {
        "type": "server", 
        "label": "サーバー (Browser Use)", 
        "description": "サーバーでWebブラウザ自動化。24時間稼働、スケジュール実行向け",
        "supported_types": ["web"]
    },
    {
        "type": "local", 
        "label": "ローカルPC (Lux)", 
        "description": "ユーザーのPCでデスクトップ操作。Excel、ローカルアプリ向け",
        "supported_types": ["desktop", "hybrid"]
    },
]


