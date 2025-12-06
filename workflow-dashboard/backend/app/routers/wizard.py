"""タスク作成ウィザード API"""
import uuid
import json
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import WizardSession, Task
from app.services.video_analyzer import video_analyzer
from app.services.wizard_chat import wizard_chat_service
from app.schemas import ChatRequest, MessageResponse

router = APIRouter(prefix="/wizard", tags=["wizard"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class StartChatRequest(BaseModel):
    """チャット開始リクエスト"""
    initial_message: Optional[str] = None


@router.post("/start-chat")
async def start_chat_session(
    request: StartChatRequest = None,
    db: Session = Depends(get_db)
):
    """チャット専用セッションを開始（動画なし）"""
    session_id = str(uuid.uuid4())
    
    # システムの挨拶メッセージ
    initial_chat = [{
        "role": "assistant",
        "content": """こんにちは！自動化タスク作成のお手伝いをします 🤖

どんな作業を自動化したいですか？以下のような例があります：

📧 **メール・通知系**
- Gmailの受信メールを自動でSlackに転送
- 特定の条件でメールを送信

📊 **データ収集・入力系**
- Webサイトから情報を定期的に取得
- スプレッドシートにデータを自動入力

🔄 **繰り返し作業**
- 毎日同じサイトでログインして確認
- SNSの投稿スケジュール

**やりたいことを自由に教えてください！** できるだけ詳しく教えてもらえると、より良い提案ができます。"""
    }]
    
    # 初期メッセージがあれば追加
    if request and request.initial_message:
        initial_chat.append({
            "role": "user",
            "content": request.initial_message
        })
    
    session = WizardSession(
        session_id=session_id,
        status="chatting",
        chat_history=json.dumps(initial_chat, ensure_ascii=False)
    )
    db.add(session)
    db.commit()
    
    return {
        "session_id": session_id,
        "status": "chatting",
        "chat_history": initial_chat
    }


@router.post("/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """動画をアップロードして分析を開始"""
    # ファイル形式チェック
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="サポートされていないファイル形式です")
    
    # セッションIDを生成
    session_id = str(uuid.uuid4())
    
    # ファイルを保存
    file_ext = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{session_id}{file_ext}"
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # セッションを作成
    session = WizardSession(
        session_id=session_id,
        video_path=str(file_path),
        status="analyzing"
    )
    db.add(session)
    db.commit()
    
    return {
        "session_id": session_id,
        "message": "動画をアップロードしました。分析を開始します。",
        "status": "analyzing"
    }


@router.post("/sessions/{session_id}/analyze")
async def analyze_video(
    session_id: str,
    additional_context: str = Form(default=""),
    db: Session = Depends(get_db)
):
    """アップロードされた動画を分析"""
    session = db.query(WizardSession).filter(
        WizardSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    
    if not session.video_path or not Path(session.video_path).exists():
        raise HTTPException(status_code=400, detail="動画ファイルが見つかりません")
    
    # 動画を分析
    result = await video_analyzer.analyze_video(
        db,
        session.video_path,
        additional_context
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "分析に失敗しました"))
    
    # セッションを更新
    session.video_analysis = json.dumps(result["analysis"], ensure_ascii=False)
    session.status = "analyzed"
    session.chat_history = json.dumps([{
        "role": "assistant",
        "content": f"動画を分析しました。\n\n目的: {result['analysis'].get('purpose', '不明')}\n\n不明点や確認したいことはありますか？"
    }], ensure_ascii=False)
    db.commit()
    
    return {
        "session_id": session_id,
        "analysis": result["analysis"],
        "status": "analyzed"
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: Session = Depends(get_db)):
    """セッション情報を取得"""
    session = db.query(WizardSession).filter(
        WizardSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    
    return {
        "session_id": session.session_id,
        "status": session.status,
        "video_analysis": json.loads(session.video_analysis) if session.video_analysis else None,
        "chat_history": json.loads(session.chat_history) if session.chat_history else [],
        "generated_task": json.loads(session.generated_task) if session.generated_task else None
    }


@router.post("/sessions/{session_id}/chat")
async def chat(
    session_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """AIとチャット"""
    session = db.query(WizardSession).filter(
        WizardSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    
    if session.status not in ["analyzed", "chatting", "active"]:
        raise HTTPException(status_code=400, detail="このセッションではチャットできません")
    
    # ステータスを更新
    if session.status in ["analyzed", "active"]:
        session.status = "chatting"
        db.commit()
    
    # チャットを実行
    result = await wizard_chat_service.chat(db, session, request.message)
    
    return {
        "response": result["response"],
        "is_ready_to_create": result.get("is_ready_to_create", False),
        "suggested_task": result.get("suggested_task"),
        "chat_history": result.get("chat_history", [])
    }


@router.post("/sessions/{session_id}/generate-task")
async def generate_task(session_id: str, db: Session = Depends(get_db)):
    """チャット履歴からタスクを生成"""
    session = db.query(WizardSession).filter(
        WizardSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    
    # タスクを生成
    result = await wizard_chat_service.generate_task(db, session)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "タスク生成に失敗しました"))
    
    return {
        "task": result["task"],
        "message": "タスクを生成しました。確認して保存してください。"
    }


@router.post("/sessions/{session_id}/create-task")
async def create_task_from_wizard(
    session_id: str,
    db: Session = Depends(get_db)
):
    """生成されたタスクをDBに保存"""
    session = db.query(WizardSession).filter(
        WizardSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    
    if not session.generated_task:
        raise HTTPException(status_code=400, detail="タスクが生成されていません")
    
    task_data = json.loads(session.generated_task)
    
    # タスクを作成
    task = Task(
        name=task_data["task_name"],
        description=task_data.get("task_description", ""),
        task_prompt=task_data["task_prompt"],
        schedule=task_data.get("schedule", ""),
        is_active=True
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # セッションを完了に更新
    session.status = "completed"
    db.commit()
    
    return {
        "task_id": task.id,
        "message": "タスクを作成しました"
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: Session = Depends(get_db)):
    """セッションを削除"""
    session = db.query(WizardSession).filter(
        WizardSession.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    
    # 動画ファイルを削除
    if session.video_path and Path(session.video_path).exists():
        Path(session.video_path).unlink()
    
    db.delete(session)
    db.commit()
    
    return {"message": "セッションを削除しました"}


