"""
アプリケーション設定

環境変数の設定:
- DATABASE_URL: データベース接続URL (default: sqlite:///./data/workflow.db)
- ENCRYPTION_KEY: 認証情報暗号化キー (python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" で生成)
- IN_DOCKER: Docker環境フラグ (default: False)
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./data/workflow.db"
    
    # Encryption
    encryption_key: str = "default-key-change-in-production"
    
    # Docker flag
    in_docker: bool = False
    
    # API Settings
    api_prefix: str = "/api"
    
    # CORS
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173"]
    
    # API Keys (オプション - .envから読み込む)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    browser_use_api_key: str = ""
    
    # Supabase Settings
    supabase_url: str = "https://vyvarctfzslbthdbsmvd.supabase.co"
    supabase_anon_key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5dmFyY3RmenNsYnRoZGJzbXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDU1NjcsImV4cCI6MjA4MDQyMTU2N30.FZDTrLLeFrou-ZYSOhegGkHIe0mqDYS_ne9pginpYE8"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # 追加のフィールドを無視


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

