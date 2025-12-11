#!/usr/bin/env python3
"""
Browser Automation Script for GitHub Actions

このスクリプトはGitHub Actions上で実行され、
browser-use + Claude Sonnet 4 を使ってWebブラウザを自動操作します。

環境変数:
    ANTHROPIC_API_KEY: Anthropic APIキー
    TASK_PROMPT: 実行するタスクの指示
    TARGET_URL: 対象URL（オプション）
    MAX_STEPS: 最大ステップ数（デフォルト: 20）
    EXECUTION_ID: 実行ID
    TASK_ID: タスクID
    SITE_USERNAME: サイトログイン用ユーザー名（オプション）
    SITE_PASSWORD: サイトログイン用パスワード（オプション）

出力:
    results/result.json: 実行結果
    screenshots/: スクリーンショット
"""

import asyncio
import json
import os
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional


def setup_directories():
    """結果保存用ディレクトリを作成"""
    Path("results").mkdir(exist_ok=True)
    Path("screenshots").mkdir(exist_ok=True)


def save_result(success: bool, result: Optional[str] = None, error: Optional[str] = None, 
                steps_completed: int = 0, screenshots: list = None):
    """実行結果をJSONファイルに保存"""
    data = {
        "success": success,
        "result": result,
        "error": error,
        "steps_completed": steps_completed,
        "screenshots": screenshots or [],
        "completed_at": datetime.utcnow().isoformat(),
        "execution_id": os.environ.get("EXECUTION_ID"),
        "task_id": os.environ.get("TASK_ID")
    }
    
    with open("results/result.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*50}")
    print("📊 Execution Result:")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"{'='*50}\n")


async def run_browser_automation():
    """メイン自動化処理"""
    
    # 環境変数から設定を取得
    task_prompt = os.environ.get("TASK_PROMPT", "")
    target_url = os.environ.get("TARGET_URL", "")
    max_steps = int(os.environ.get("MAX_STEPS", "20"))
    execution_id = os.environ.get("EXECUTION_ID", "unknown")
    task_id = os.environ.get("TASK_ID", "unknown")
    
    # 認証情報（オプション）
    site_username = os.environ.get("SITE_USERNAME", "")
    site_password = os.environ.get("SITE_PASSWORD", "")
    
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║       Browser Automation - GitHub Actions Worker              ║
╚═══════════════════════════════════════════════════════════════╝

📋 Task ID: {task_id}
🔢 Execution ID: {execution_id}
🌐 Target URL: {target_url or '(none)'}
📝 Max Steps: {max_steps}
🔐 Credentials: {'Yes' if site_username else 'No'}

📄 Task Prompt:
{task_prompt[:500]}{'...' if len(task_prompt) > 500 else ''}

{'='*60}
""")
    
    if not task_prompt:
        save_result(False, error="タスクプロンプトが指定されていません")
        return
    
    # Anthropic APIキーの確認
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        save_result(False, error="ANTHROPIC_API_KEY が設定されていません")
        return
    
    try:
        # browser-use と langchain-anthropic をインポート
        from browser_use import Agent, BrowserConfig
        from langchain_anthropic import ChatAnthropic
        
        print("✅ browser-use ライブラリをインポートしました")
        
    except ImportError as e:
        save_result(False, error=f"必要なライブラリがインストールされていません: {e}")
        return
    
    # タスクプロンプトを構築
    full_prompt = task_prompt
    
    # URLが指定されている場合は追加
    if target_url:
        full_prompt = f"対象URL: {target_url}\n\n{full_prompt}"
    
    # 認証情報が指定されている場合は追加
    if site_username and site_password:
        full_prompt += f"\n\nログイン情報:\nユーザー名: {site_username}\nパスワード: {site_password}"
    
    step_count = 0
    screenshots = []
    
    try:
        # LLMを設定（Claude Sonnet 4）
        llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=api_key,
            timeout=120,
            max_retries=2
        )
        
        print("✅ Claude Sonnet 4 を初期化しました")
        
        # ブラウザ設定（ヘッドレスモード必須）
        browser_config = BrowserConfig(
            headless=True,  # GitHub Actionsでは必須
            disable_security=True,  # セキュリティポップアップ回避
            extra_chromium_args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-breakpad",
                "--disable-component-update",
                "--disable-domain-reliability",
                "--disable-features=AudioServiceOutOfProcess",
                "--disable-hang-monitor",
                "--disable-ipc-flooding-protection",
                "--disable-popup-blocking",
                "--disable-prompt-on-repost",
                "--disable-renderer-backgrounding",
                "--disable-sync",
                "--force-color-profile=srgb",
                "--metrics-recording-only",
                "--no-first-run",
                "--enable-features=NetworkService,NetworkServiceInProcess",
                "--password-store=basic",
                "--use-mock-keychain",
            ]
        )
        
        print("✅ ブラウザ設定を構成しました（ヘッドレスモード）")
        
        # エージェントを作成
        agent = Agent(
            task=full_prompt,
            llm=llm,
            browser_config=browser_config,
            max_actions_per_step=5
        )
        
        print("✅ Agentを作成しました")
        print(f"🚀 タスク実行開始...\n")
        
        # 実行
        result = await agent.run(max_steps=max_steps)
        
        print(f"\n✅ タスク実行完了")
        
        # 結果を保存
        save_result(
            success=True,
            result=str(result) if result else "タスクが完了しました",
            steps_completed=step_count,
            screenshots=screenshots
        )
        
    except Exception as e:
        error_message = str(e)
        traceback_str = traceback.format_exc()
        
        print(f"\n❌ エラー発生: {error_message}")
        print(f"Traceback:\n{traceback_str}")
        
        # エラー詳細を保存
        save_result(
            success=False,
            error=error_message,
            steps_completed=step_count,
            screenshots=screenshots
        )


def main():
    """エントリーポイント"""
    print(f"🕐 開始時刻: {datetime.utcnow().isoformat()}")
    
    # ディレクトリ作成
    setup_directories()
    
    # Python バージョン確認
    print(f"🐍 Python: {sys.version}")
    
    # 非同期処理を実行
    try:
        asyncio.run(run_browser_automation())
    except KeyboardInterrupt:
        print("\n⚠️ 実行が中断されました")
        save_result(False, error="実行が中断されました")
    except Exception as e:
        print(f"\n❌ 予期しないエラー: {e}")
        save_result(False, error=str(e))
    
    print(f"🕐 終了時刻: {datetime.utcnow().isoformat()}")


if __name__ == "__main__":
    main()
