"""システム情報・権限チェック API"""
import os
import platform
import subprocess
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.openai_client import get_available_models, DEFAULT_CHAT_MODEL

router = APIRouter(prefix="/system", tags=["system"])


class PermissionStatus(BaseModel):
    """権限ステータス"""
    screen_recording: bool = False
    accessibility: bool = False
    oagi_installed: bool = False
    oagi_api_key_set: bool = False
    platform: str = ""
    message: str = ""


class SystemInfo(BaseModel):
    """システム情報"""
    platform: str
    platform_version: str
    python_version: str
    oagi_installed: bool
    oagi_version: Optional[str] = None
    permissions: PermissionStatus


@router.get("/info", response_model=SystemInfo)
def get_system_info():
    """システム情報を取得"""
    import sys
    
    # OAGI SDKのチェック
    oagi_installed = False
    oagi_version = None
    try:
        import oagi
        oagi_installed = True
        oagi_version = getattr(oagi, "__version__", "unknown")
    except ImportError:
        pass
    
    # 権限チェック
    permissions = check_permissions()
    
    return SystemInfo(
        platform=platform.system(),
        platform_version=platform.version(),
        python_version=sys.version,
        oagi_installed=oagi_installed,
        oagi_version=oagi_version,
        permissions=permissions
    )


@router.get("/permissions", response_model=PermissionStatus)
def check_permissions():
    """システム権限をチェック（macOS向け）"""
    status = PermissionStatus(
        platform=platform.system()
    )
    
    # OAGI SDKのチェック
    try:
        import oagi
        status.oagi_installed = True
    except ImportError:
        status.oagi_installed = False
        status.message = "OAGI SDK がインストールされていません。pip install oagi を実行してください。"
        return status
    
    # OAGI APIキーのチェック
    status.oagi_api_key_set = bool(os.environ.get("OAGI_API_KEY"))
    
    if platform.system() == "Darwin":  # macOS
        # 画面収録権限のチェック（PyAutoGUIでスクリーンショットを試す）
        try:
            import pyautogui
            # 小さなスクリーンショットを試行
            screenshot = pyautogui.screenshot(region=(0, 0, 1, 1))
            status.screen_recording = True
        except Exception as e:
            status.screen_recording = False
            if "not permitted" in str(e).lower() or "permission" in str(e).lower():
                status.message = "画面収録の権限が必要です。"
        
        # アクセシビリティ権限のチェック（CGEventSourceStateでチェック）
        try:
            import Quartz
            # アクセシビリティが有効か確認
            trusted = Quartz.AXIsProcessTrusted()
            status.accessibility = trusted
            if not trusted:
                status.message += " アクセシビリティの権限が必要です。"
        except ImportError:
            # pyobjcがない場合はスキップ
            status.accessibility = None
        except Exception:
            status.accessibility = None
    
    elif platform.system() == "Windows":
        # Windowsでは通常、特別な権限は不要
        status.screen_recording = True
        status.accessibility = True
    
    else:
        # Linux
        status.screen_recording = True
        status.accessibility = True
    
    if not status.message:
        if status.screen_recording and status.accessibility and status.oagi_api_key_set:
            status.message = "すべての権限が正常に設定されています。"
        elif not status.oagi_api_key_set:
            status.message = "OAGI APIキーが設定されていません。"
    
    return status


@router.get("/permissions/instructions")
def get_permission_instructions():
    """権限設定の手順を取得"""
    system = platform.system()
    
    if system == "Darwin":  # macOS
        return {
            "platform": "macOS",
            "instructions": {
                "screen_recording": {
                    "title": "画面収録の権限",
                    "steps": [
                        "システム環境設定を開く",
                        "「セキュリティとプライバシー」→「プライバシー」タブ",
                        "左側のリストから「画面収録」を選択",
                        "ターミナル（またはPythonを実行しているアプリ）にチェックを入れる",
                        "アプリを再起動"
                    ],
                    "command": "open 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'"
                },
                "accessibility": {
                    "title": "アクセシビリティの権限",
                    "steps": [
                        "システム環境設定を開く",
                        "「セキュリティとプライバシー」→「プライバシー」タブ",
                        "左側のリストから「アクセシビリティ」を選択",
                        "ターミナル（またはPythonを実行しているアプリ）にチェックを入れる",
                        "アプリを再起動"
                    ],
                    "command": "open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'"
                }
            },
            "cli_check": "oagi agent permission"
        }
    
    elif system == "Windows":
        return {
            "platform": "Windows",
            "instructions": {
                "note": "Windowsでは通常、特別な権限設定は不要です。",
                "steps": [
                    "管理者権限でターミナルを実行することを推奨",
                    "ウイルス対策ソフトがPyAutoGUIをブロックしていないか確認"
                ]
            }
        }
    
    else:  # Linux
        return {
            "platform": "Linux",
            "instructions": {
                "note": "Linuxでは、X11またはWaylandの設定が必要な場合があります。",
                "steps": [
                    "X11環境であることを確認",
                    "xdotoolがインストールされているか確認: apt install xdotool"
                ]
            }
        }


# ==================== AIモデル設定 ====================

@router.get("/ai-models")
def get_ai_models():
    """利用可能なAIモデルリストを取得"""
    models = get_available_models()
    return {
        "models": models,
        "default": DEFAULT_CHAT_MODEL
    }



