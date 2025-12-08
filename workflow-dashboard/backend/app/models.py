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
    tasks_as_lux = relationship("Task", back_populates="lux_credential", foreign_keys="Task.lux_credential_id")


class Project(Base):
    """プロジェクトテーブル"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(20), default="#6366f1")  # プロジェクトカラー
    icon = Column(String(50), default="folder")  # Lucide icon名
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    role_groups = relationship("RoleGroup", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    """タスクテーブル"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), index=True)  # Supabase user ID (nullable for local dev)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # プロジェクトID
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    task_prompt = Column(Text, nullable=False)
    schedule = Column(String(100))  # cron形式
    is_active = Column(Boolean, default=True)
    notify_on_success = Column(Boolean, default=False)
    notify_on_failure = Column(Boolean, default=True)
    notification_channel = Column(String(50))  # slack, email
    notification_target = Column(String(255))
    
    # 実行タイプ: web (Browser Use), desktop (Lux), hybrid (両方)
    execution_type = Column(String(20), default="web")
    max_steps = Column(Integer, default=20)  # 最大ステップ数
    
    # 実行場所: server (サーバーで実行), local (ローカルエージェント経由)
    execution_location = Column(String(20), default="server")
    
    # グループ分け（役割・フェーズ）
    role_group = Column(String(100), default="General")
    role_group_id = Column(Integer, ForeignKey("role_groups.id"), nullable=True)
    
    # 依存関係（前のタスクIDのリストをJSON文字列で保存）
    dependencies = Column(Text, default="[]")
    
    # 順序（カンバンボードでの表示順）
    order_index = Column(Integer, default=0)
    
    # 認証情報への参照
    llm_credential_id = Column(Integer, ForeignKey("credentials.id"))
    site_credential_id = Column(Integer, ForeignKey("credentials.id"))
    notification_credential_id = Column(Integer, ForeignKey("credentials.id"))
    lux_credential_id = Column(Integer, ForeignKey("credentials.id"))  # Lux (OAGI) API Key
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    llm_credential = relationship("Credential", back_populates="tasks_as_llm", foreign_keys=[llm_credential_id])
    site_credential = relationship("Credential", back_populates="tasks_as_site", foreign_keys=[site_credential_id])
    notification_credential = relationship("Credential", back_populates="tasks_as_notification", foreign_keys=[notification_credential_id])
    lux_credential = relationship("Credential", back_populates="tasks_as_lux", foreign_keys=[lux_credential_id])
    executions = relationship("Execution", back_populates="task", cascade="all, delete-orphan")
    triggers = relationship("TaskTrigger", back_populates="task", foreign_keys="TaskTrigger.task_id", cascade="all, delete-orphan")


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


class TaskTrigger(Base):
    """タスクトリガーテーブル（時間・条件トリガー）"""
    __tablename__ = "task_triggers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    trigger_type = Column(String(50), nullable=False)  # time, cron, dependency, manual
    
    # 時間トリガー設定
    trigger_time = Column(String(10))  # HH:MM形式
    trigger_days = Column(String(50))  # JSON配列: ["mon", "tue", ...]
    
    # Cronトリガー設定
    cron_expression = Column(String(100))
    
    # 依存トリガー設定
    depends_on_task_id = Column(Integer, ForeignKey("tasks.id"))
    trigger_on_status = Column(String(20), default="completed")  # completed, failed, any
    
    # 遅延設定（依存タスク完了後X分待つ）
    delay_minutes = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    task = relationship("Task", back_populates="triggers", foreign_keys=[task_id])
    depends_on_task = relationship("Task", foreign_keys=[depends_on_task_id])

    __table_args__ = (
        Index("idx_task_triggers_task_id", "task_id"),
    )


class RoleGroup(Base):
    """役割グループテーブル（フォルダ管理）"""
    __tablename__ = "role_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    color = Column(String(20), default="#6366f1")  # インディゴ
    icon = Column(String(50), default="folder")  # Lucide icon名
    order_index = Column(Integer, default=0)  # 表示順序
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="role_groups")

    __table_args__ = (
        Index("idx_role_groups_project_id", "project_id"),
    )
