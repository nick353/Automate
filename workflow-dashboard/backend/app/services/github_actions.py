"""
GitHub Actions ディスパッチサービス

ZeaburからGitHub Actionsにタスク実行を委託するためのサービス。
重い処理（ブラウザ自動化）をGitHub Actionsの豊富なリソースで実行する。

使用方法:
1. GitHub Personal Access Token (PAT) を環境変数 GITHUB_PAT に設定
2. リポジトリ情報を環境変数 GITHUB_REPO_OWNER, GITHUB_REPO_NAME に設定
3. タスク実行時に dispatch_task() を呼び出す
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import httpx

from app.utils.logger import logger


class GitHubActionsService:
    """GitHub Actions へタスクをディスパッチするサービス"""
    
    def __init__(self):
        self.github_pat = os.environ.get("GITHUB_PAT", "")
        self.repo_owner = os.environ.get("GITHUB_REPO_OWNER", "")
        self.repo_name = os.environ.get("GITHUB_REPO_NAME", "")
        self.api_base = "https://api.github.com"
        
    def is_configured(self) -> bool:
        """GitHub Actions が設定されているか確認"""
        return bool(self.github_pat and self.repo_owner and self.repo_name)
    
    def get_headers(self) -> Dict[str, str]:
        """GitHub API用のヘッダーを取得"""
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self.github_pat}",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    
    async def dispatch_task(
        self,
        task_id: int,
        execution_id: int,
        task_prompt: str,
        target_url: Optional[str] = None,
        max_steps: int = 20,
        credentials: Optional[Dict[str, str]] = None,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        GitHub Actions にタスクをディスパッチ
        
        Args:
            task_id: タスクID
            execution_id: 実行ID
            task_prompt: AIエージェントへの指示
            target_url: 対象URL（オプション）
            max_steps: 最大ステップ数
            credentials: 認証情報（サイトログイン等）
            callback_url: 結果を送信するWebhook URL
        
        Returns:
            ディスパッチ結果
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "GitHub Actions が設定されていません。環境変数を確認してください。",
                "required_env_vars": ["GITHUB_PAT", "GITHUB_REPO_OWNER", "GITHUB_REPO_NAME"]
            }
        
        # ペイロードを構築
        client_payload = {
            "task_id": task_id,
            "execution_id": execution_id,
            "task_prompt": task_prompt,
            "target_url": target_url or "",
            "max_steps": max_steps,
            "callback_url": callback_url or "",
            "dispatched_at": datetime.utcnow().isoformat(),
            # 認証情報は機密なのでGitHub Secretsから取得する設計
            # ここでは認証情報のキー名のみを渡す
            "credential_keys": list(credentials.keys()) if credentials else []
        }
        
        # Repository Dispatch API を呼び出し
        url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/dispatches"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers=self.get_headers(),
                    json={
                        "event_type": "run-browser-task",
                        "client_payload": client_payload
                    }
                )
                
                if response.status_code == 204:
                    # 成功（204 No Content）
                    logger.info(
                        f"GitHub Actions にタスクをディスパッチしました: "
                        f"task_id={task_id}, execution_id={execution_id}"
                    )
                    return {
                        "success": True,
                        "message": "タスクをGitHub Actionsに送信しました。実行完了までお待ちください。",
                        "execution_id": execution_id,
                        "estimated_start": "30秒〜1分後"
                    }
                else:
                    error_detail = response.text
                    logger.error(f"GitHub Actions ディスパッチエラー: {response.status_code} - {error_detail}")
                    return {
                        "success": False,
                        "error": f"GitHub API エラー: {response.status_code}",
                        "detail": error_detail
                    }
                    
        except httpx.TimeoutException:
            logger.error("GitHub API タイムアウト")
            return {
                "success": False,
                "error": "GitHub API への接続がタイムアウトしました"
            }
        except Exception as e:
            logger.error(f"GitHub Actions ディスパッチ例外: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def check_workflow_status(self, run_id: int) -> Dict[str, Any]:
        """
        ワークフロー実行状態を確認
        
        Args:
            run_id: ワークフロー実行ID
        
        Returns:
            実行状態
        """
        if not self.is_configured():
            return {"success": False, "error": "GitHub Actions が設定されていません"}
        
        url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/actions/runs/{run_id}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.get_headers())
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "status": data.get("status"),  # queued, in_progress, completed
                        "conclusion": data.get("conclusion"),  # success, failure, cancelled
                        "html_url": data.get("html_url"),
                        "created_at": data.get("created_at"),
                        "updated_at": data.get("updated_at")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"ワークフロー取得エラー: {response.status_code}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def list_recent_runs(self, limit: int = 10) -> Dict[str, Any]:
        """
        最近のワークフロー実行を取得
        
        Args:
            limit: 取得件数
        
        Returns:
            ワークフロー実行リスト
        """
        if not self.is_configured():
            return {"success": False, "error": "GitHub Actions が設定されていません"}
        
        url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/actions/runs"
        params = {
            "event": "repository_dispatch",
            "per_page": limit
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.get_headers(), params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    runs = [
                        {
                            "id": run["id"],
                            "status": run["status"],
                            "conclusion": run.get("conclusion"),
                            "created_at": run["created_at"],
                            "html_url": run["html_url"]
                        }
                        for run in data.get("workflow_runs", [])
                    ]
                    return {
                        "success": True,
                        "runs": runs,
                        "total_count": data.get("total_count", 0)
                    }
                else:
                    return {
                        "success": False,
                        "error": f"ワークフロー一覧取得エラー: {response.status_code}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def cancel_workflow(self, run_id: int) -> Dict[str, Any]:
        """
        ワークフローをキャンセル
        
        Args:
            run_id: ワークフロー実行ID
        
        Returns:
            キャンセル結果
        """
        if not self.is_configured():
            return {"success": False, "error": "GitHub Actions が設定されていません"}
        
        url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/actions/runs/{run_id}/cancel"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=self.get_headers())
                
                if response.status_code == 202:
                    return {
                        "success": True,
                        "message": "ワークフローのキャンセルをリクエストしました"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"キャンセルエラー: {response.status_code}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}


# シングルトンインスタンス
github_actions_service = GitHubActionsService()
