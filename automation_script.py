"""
GitHub Actions用の自動化実行スクリプト

このスクリプトはGitHub Actions内で実行され、Browser Useを使ってタスクを実行します。
実行結果はZeaburのバックエンドにWebhookで送信されます。
"""
import os
import sys
import json
import asyncio
import httpx
from datetime import datetime
from pathlib import Path

# 結果ディレクトリを作成
RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(exist_ok=True)

SCREENSHOTS_DIR = Path("screenshots")
SCREENSHOTS_DIR.mkdir(exist_ok=True)


async def run_browser_task():
    """Browser Useタスクを実行"""
    # 環境変数から取得
    task_id = os.environ.get("TASK_ID")
    execution_id = os.environ.get("EXECUTION_ID")
    task_prompt = os.environ.get("TASK_PROMPT")
    target_url = os.environ.get("TARGET_URL")
    max_steps = int(os.environ.get("MAX_STEPS", "20"))
    callback_url = os.environ.get("CALLBACK_URL")
    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY")
    
    print("=" * 60)
    print("GitHub Actions - Browser Automation Task")
    print("=" * 60)
    print(f"Task ID: {task_id}")
    print(f"Execution ID: {execution_id}")
    print(f"Task Prompt: {task_prompt[:100]}...")
    print(f"Max Steps: {max_steps}")
    print("=" * 60)
    
    if not task_prompt:
        return {
            "success": False,
            "error": "TASK_PROMPT environment variable is not set"
        }
    
    if not anthropic_api_key:
        return {
            "success": False,
            "error": "ANTHROPIC_API_KEY environment variable is not set"
        }
    
    try:
        # Browser Useをインポート
        from browser_use import Agent, BrowserProfile
        from langchain_anthropic import ChatAnthropic
        from playwright.async_api import async_playwright
        
        print("\n✅ Browser Use and dependencies imported successfully")
        
        # LLMを初期化
        llm = ChatAnthropic(
            model="claude-sonnet-4-5-20250929",
            api_key=anthropic_api_key,
            timeout=60
        )
        print("✅ LLM initialized (Claude Sonnet 4.5)")
        
        # Browser Profileを作成（ヘッドレス）
        browser_profile = BrowserProfile(
            headless=True,
            disable_security=False
        )
        print("✅ Browser profile created (headless mode)")
        
        # Agentを作成
        agent = Agent(
            task=task_prompt,
            llm=llm,
            browser_profile=browser_profile
        )
        print("✅ Agent created")
        
        print(f"\n🚀 Starting task execution (max {max_steps} steps)...")
        print("-" * 60)
        
        # タスクを実行
        result = await agent.run()
        
        print("-" * 60)
        print("✅ Task completed successfully!")
        print(f"Result: {result}")
        
        return {
            "success": True,
            "result": str(result),
            "steps_executed": "N/A",  # Browser Useは内部でステップを管理
            "completed_at": datetime.now().isoformat()
        }
    
    except ImportError as e:
        error_msg = f"Failed to import required modules: {str(e)}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }
    
    except Exception as e:
        error_msg = f"Task execution failed: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": error_msg,
            "traceback": traceback.format_exc()
        }


async def send_callback(callback_url, result):
    """結果をZeaburのバックエンドに送信"""
    if not callback_url:
        print("⚠️  Callback URL not set, skipping notification")
        return
    
    try:
        print(f"\n📤 Sending result to callback URL: {callback_url}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                callback_url,
                json=result,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Actions": "true"
                }
            )
            
            if response.status_code in [200, 201]:
                print("✅ Callback sent successfully")
            else:
                print(f"⚠️  Callback failed: {response.status_code} {response.text}")
    
    except Exception as e:
        print(f"❌ Failed to send callback: {e}")


async def main():
    """メインエントリーポイント"""
    start_time = datetime.now()
    
    # タスクを実行
    result = await run_browser_task()
    
    # 結果をファイルに保存
    result_file = RESULTS_DIR / "result.json"
    with open(result_file, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n💾 Result saved to {result_file}")
    
    # コールバックを送信
    callback_url = os.environ.get("CALLBACK_URL")
    if callback_url:
        # 実行IDとタスクIDを追加
        result["execution_id"] = int(os.environ.get("EXECUTION_ID", "0"))
        result["task_id"] = int(os.environ.get("TASK_ID", "0"))
        await send_callback(callback_url, result)
    
    # 実行時間を表示
    duration = datetime.now() - start_time
    print(f"\n⏱️  Total execution time: {duration}")
    
    # 成功/失敗で終了コードを設定
    if result.get("success"):
        print("\n✅ Automation task completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Automation task failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
