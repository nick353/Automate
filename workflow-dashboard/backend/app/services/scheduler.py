"""スケジューラーサービス"""
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Task, Execution
from app.utils.logger import logger


class SchedulerService:
    """APSchedulerを使ったタスクスケジューリング"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._started = False
    
    def start(self):
        """スケジューラーを開始"""
        if not self._started:
            self.scheduler.start()
            self._started = True
            logger.info("スケジューラーを開始しました")
            self._load_scheduled_tasks()
    
    def stop(self):
        """スケジューラーを停止"""
        if self._started:
            self.scheduler.shutdown()
            self._started = False
            logger.info("スケジューラーを停止しました")
    
    def _load_scheduled_tasks(self):
        """DBからスケジュール設定されたタスクを読み込み"""
        db = SessionLocal()
        try:
            tasks = db.query(Task).filter(
                Task.is_active == True,
                Task.schedule != None,
                Task.schedule != ""
            ).all()
            
            for task in tasks:
                self.add_task(task.id, task.schedule)
            
            logger.info(f"{len(tasks)}件のスケジュールタスクを読み込みました")
        finally:
            db.close()
    
    def add_task(self, task_id: int, schedule: str) -> bool:
        """タスクをスケジュールに追加"""
        try:
            # 既存のジョブがあれば削除
            job_id = f"task_{task_id}"
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)
            
            # cron形式でトリガーを作成
            trigger = CronTrigger.from_crontab(schedule)
            
            # ジョブを追加
            self.scheduler.add_job(
                self._run_task,
                trigger,
                id=job_id,
                args=[task_id],
                replace_existing=True
            )
            
            logger.info(f"タスク {task_id} をスケジュール登録: {schedule}")
            return True
            
        except Exception as e:
            logger.error(f"スケジュール登録エラー (task_id={task_id}): {e}")
            return False
    
    def remove_task(self, task_id: int):
        """タスクをスケジュールから削除"""
        job_id = f"task_{task_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"タスク {task_id} をスケジュールから削除")
    
    def update_task(self, task_id: int, schedule: Optional[str]):
        """タスクのスケジュールを更新"""
        if schedule:
            self.add_task(task_id, schedule)
        else:
            self.remove_task(task_id)
    
    async def _run_task(self, task_id: int):
        """スケジュールされたタスクを実行"""
        from app.services.agent import run_task_with_live_view
        
        db = SessionLocal()
        try:
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task or not task.is_active:
                logger.warning(f"タスク {task_id} は無効または存在しません")
                return
            
            # 実行レコードを作成
            execution = Execution(
                task_id=task_id,
                status="pending",
                triggered_by="schedule",
                started_at=datetime.utcnow()
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            
            logger.info(f"スケジュール実行開始: task_id={task_id}, execution_id={execution.id}")
            
            # エージェントを実行
            await run_task_with_live_view(task_id, execution.id)
            
        except Exception as e:
            logger.error(f"スケジュール実行エラー (task_id={task_id}): {e}")
        finally:
            db.close()
    
    def get_next_run_time(self, task_id: int) -> Optional[datetime]:
        """次回実行時刻を取得"""
        job = self.scheduler.get_job(f"task_{task_id}")
        if job:
            return job.next_run_time
        return None
    
    def get_all_jobs(self) -> list:
        """全てのジョブを取得"""
        return [
            {
                "id": job.id,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            }
            for job in self.scheduler.get_jobs()
        ]


# シングルトンインスタンス
scheduler_service = SchedulerService()




