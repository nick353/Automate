"""SQLAlchemy データベースモデル"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


class Credential(Base):
    """認証情報テーブル"""
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), index=True)  # Supabase user ID (nullable for local dev)
    name = Column(String(255), nullable=False)
    credential_type = Column(String(50), nullable=False)  # api_key, login, webhook
    service_name = Column(String(100))  # anthropic, google, slack, etc.
    data = Column(Text, nullable=False)  # 暗号化された認証データJSON
    description = Column(Text)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tasks_as_llm = relationship("Task", back_populates="llm_credential", foreign_keys="Task.llm_credential_id")
    tasks_as_site = relationship("Task", back_populates="site_credential", foreign_keys="Task.site_credential_id")
    tasks_as_notification = relationship("Task", back_populates="notification_credential", foreign_keys="Task.notification_credential_id")


class Task(Base):
    """タスクテーブル"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), index=True)  # Supabase user ID (nullable for local dev)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    task_prompt = Column(Text, nullable=False)
    schedule = Column(String(100))  # cron形式
    is_active = Column(Boolean, default=True)
    notify_on_success = Column(Boolean, default=False)
    notify_on_failure = Column(Boolean, default=True)
    notification_channel = Column(String(50))  # slack, email
    notification_target = Column(String(255))
    
    # 認証情報への参照
    llm_credential_id = Column(Integer, ForeignKey("credentials.id"))
    site_credential_id = Column(Integer, ForeignKey("credentials.id"))
    notification_credential_id = Column(Integer, ForeignKey("credentials.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    llm_credential = relationship("Credential", back_populates="tasks_as_llm", foreign_keys=[llm_credential_id])
    site_credential = relationship("Credential", back_populates="tasks_as_site", foreign_keys=[site_credential_id])
    notification_credential = relationship("Credential", back_populates="tasks_as_notification", foreign_keys=[notification_credential_id])
    executions = relationship("Execution", back_populates="task", cascade="all, delete-orphan")


class Execution(Base):
    """実行履歴テーブル"""
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    status = Column(String(20), nullable=False)  # pending, running, paused, completed, failed, stopped
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    result = Column(Text)
    error_message = Column(Text)
    log_file = Column(String(255))
    triggered_by = Column(String(20))  # manual, schedule, api
    
    # ライブビュー用
    total_steps = Column(Integer, default=0)
    completed_steps = Column(Integer, default=0)
    current_step_id = Column(Integer, ForeignKey("execution_steps.id", use_alter=True))
    last_screenshot_path = Column(String(255))

    # Relationships
    task = relationship("Task", back_populates="executions")
    steps = relationship("ExecutionStep", back_populates="execution", foreign_keys="ExecutionStep.execution_id", cascade="all, delete-orphan")


class ExecutionStep(Base):
    """実行ステップテーブル（ライブビュー用）"""
    __tablename__ = "execution_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(Integer, ForeignKey("executions.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    action_type = Column(String(50), nullable=False)  # navigate, click, type, scroll, extract, etc.
    description = Column(Text)
    status = Column(String(20), default="pending")  # pending, running, completed, failed, skipped
    screenshot_path = Column(String(255))
    element_selector = Column(Text)
    input_value = Column(Text)  # マスク済み
    result = Column(Text)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_ms = Column(Integer)

    # Relationships
    execution = relationship("Execution", back_populates="steps", foreign_keys=[execution_id])

    __table_args__ = (
        Index("idx_execution_steps_execution_id", "execution_id"),
    )


class ExecutionControl(Base):
    """実行制御テーブル"""
    __tablename__ = "execution_control"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(Integer, ForeignKey("executions.id"), nullable=False, unique=True)
    status = Column(String(20), default="running")  # running, paused, stopping, stopped
    paused_at = Column(DateTime)
    resumed_at = Column(DateTime)
    stop_requested = Column(Boolean, default=False)


class WizardSession(Base):
    """ウィザードセッションテーブル（動画分析・チャット用）"""
    __tablename__ = "wizard_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), nullable=False, unique=True)  # UUID
    video_path = Column(String(255))
    video_analysis = Column(Text)  # Geminiの分析結果
    chat_history = Column(Text)  # JSONで保存
    generated_task = Column(Text)  # 生成されたタスクプロンプト
    status = Column(String(20), default="active")  # active, completed, abandoned
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

