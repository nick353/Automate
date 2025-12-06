"""
Lux統合用データベースマイグレーションスクリプト

新しいカラムを追加:
- tasks.execution_type: 実行タイプ (web, desktop, hybrid)
- tasks.max_steps: 最大ステップ数
- tasks.lux_credential_id: Lux APIキー参照

使用方法:
    cd workflow-dashboard/backend
    source venv/bin/activate
    python migrate_lux.py
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/workflow.db")

def migrate():
    if not DB_PATH.exists():
        print(f"データベースが見つかりません: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 既存のカラムをチェック
    cursor.execute("PRAGMA table_info(tasks)")
    columns = {col[1] for col in cursor.fetchall()}
    
    migrations = []
    
    # execution_type カラムを追加
    if "execution_type" not in columns:
        migrations.append(
            "ALTER TABLE tasks ADD COLUMN execution_type VARCHAR(20) DEFAULT 'web'"
        )
        print("✓ execution_type カラムを追加")
    
    # max_steps カラムを追加
    if "max_steps" not in columns:
        migrations.append(
            "ALTER TABLE tasks ADD COLUMN max_steps INTEGER DEFAULT 20"
        )
        print("✓ max_steps カラムを追加")
    
    # lux_credential_id カラムを追加
    if "lux_credential_id" not in columns:
        migrations.append(
            "ALTER TABLE tasks ADD COLUMN lux_credential_id INTEGER REFERENCES credentials(id)"
        )
        print("✓ lux_credential_id カラムを追加")
    
    # execution_location カラムを追加
    if "execution_location" not in columns:
        migrations.append(
            "ALTER TABLE tasks ADD COLUMN execution_location VARCHAR(20) DEFAULT 'server'"
        )
        print("✓ execution_location カラムを追加")
    
    # マイグレーションを実行
    for sql in migrations:
        try:
            cursor.execute(sql)
            conn.commit()
        except sqlite3.OperationalError as e:
            print(f"警告: {e}")
    
    if not migrations:
        print("マイグレーション不要: すべてのカラムが既に存在します")
    else:
        print(f"\n{len(migrations)} 件のマイグレーションを完了しました")
    
    conn.close()

if __name__ == "__main__":
    migrate()

