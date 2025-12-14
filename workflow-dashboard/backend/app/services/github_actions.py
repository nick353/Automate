"""GitHub Actions統合サービス"""
import os
import httpx
from typing import Optional, Dict, Any
from app.utils.logger import logger


class GitHubActionsService:
    """GitHub Actionsでタスクを実行するサービス"""
    
    def __init__(self):
        self.github_token = os.environ.get("GITHUB_PAT")  # Personal Access Token
        self.repo_owner = os.environ.get("GITHUB_REPO_OWNER")
        self.repo_name = os.environ.get("GITHUB_REPO_NAME")
    
    def is_configured(self) -> bool:
        """GitHub Actionsが設定されているか確認"""
        return bool(self.github_token and self.repo_owner and self.repo_name)
    
    async def dispatch_task(
        self,
        task_id: int,
        execution_id: int,
        task_prompt: str,
        target_url: Optional[str] = None,
        max_steps: int = 20,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """GitHub Actionsにrepository_dispatchイベントを送信
        
        Args:
            task_id: タスクID
            execution_id: 実行ID
            task_prompt: タスクの指示内容
            target_url: ターゲットURL（オプション）
            max_steps: 最大ステップ数
            callback_url: 完了時のコールバックURL
        
        Returns:
            {"success": True/False, "error": "エラーメッセージ"}
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "GitHub Actionsが設定されていません。GITHUB_PAT, GITHUB_REPO_OWNER, GITHUB_REPO_NAMEを設定してください。"
            }
        
        url = f"https://api.github.com/repos/{self.repo_owner}/{self.repo_name}/dispatches"
        
        headers = {
            "Authorization": f"Bearer {self.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        payload = {
            "event_type": "run-browser-task",
            "client_payload": {
                "task_id": task_id,
                "execution_id": execution_id,
                "task_prompt": task_prompt,
                "target_url": target_url or "",
                "max_steps": max_steps,
                "callback_url": callback_url or ""
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 204:
                    # 成功
                    logger.info(f"GitHub Actions dispatch successful: task_id={task_id}, execution_id={execution_id}")
                    return {
                        "success": True,
                        "message": "GitHub Actionsにタスクを送信しました",
                        "execution_id": execution_id
                    }
                else:
                    # エラー
                    error_msg = f"GitHub API error: {response.status_code} {response.text}"
                    logger.error(error_msg)
                    return {
                        "success": False,
                        "error": error_msg
                    }
        
        except httpx.TimeoutException:
            error_msg = "GitHub APIへの接続がタイムアウトしました"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"GitHub Actions dispatch failed: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
    
    async def get_workflow_run_status(
        self,
        run_id: int
    ) -> Dict[str, Any]:
        """GitHub Actions Workflow Runのステータスを取得
        
        Args:
            run_id: GitHub Actions Run ID
        
        Returns:
            {"status": "queued|in_progress|completed", "conclusion": "success|failure|..."}
        """
        if not self.is_configured():
            return {"error": "GitHub Actionsが設定されていません"}
        
        url = f"https://api.github.com/repos/{self.repo_owner}/{self.repo_name}/actions/runs/{run_id}"
        
        headers = {
            "Authorization": f"Bearer {self.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "status": data.get("status"),
                        "conclusion": data.get("conclusion"),
                        "html_url": data.get("html_url"),
                        "run_started_at": data.get("run_started_at"),
                        "updated_at": data.get("updated_at")
                    }
                else:
                    return {"error": f"GitHub API error: {response.status_code}"}
        
        except Exception as e:
            logger.error(f"Failed to get workflow run status: {e}")
            return {"error": str(e)}


# グローバルインスタンス
github_actions_service = GitHubActionsService()
