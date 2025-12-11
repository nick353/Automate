"""
Supabase マイグレーションスクリプト

新しく追加したテーブルとカラムをSupabase PostgreSQLに反映します。
使用方法: python migrate_supabase.py
"""

import sys
sys.path.insert(0, '.')

from sqlalchemy import create_engine, text, inspect
from app.config import settings

def run_migration():
    """マイグレーションを実行"""
    
    db_url = settings.effective_database_url
    print(f"データベースに接続中...")
    print(f"URL: {db_url[:50]}...")
    
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        print(f"\n既存テーブル: {existing_tables}")
        
        # ==========================================
        # 0. projects テーブルの作成（基本テーブル）
        # ==========================================
        if 'projects' not in existing_tables:
            print("\n✅ projects テーブルを作成中...")
            conn.execute(text("""
                CREATE TABLE projects (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(36),
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    color VARCHAR(20) DEFAULT '#6366f1',
                    icon VARCHAR(50) DEFAULT 'folder',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX idx_projects_user_id ON projects(user_id)"))
            conn.commit()
            print("   ✓ projects テーブルを作成しました")
            # テーブル一覧を更新
            existing_tables = inspector.get_table_names()
        else:
            print("\n⏭️ projects テーブルは既に存在します")
            # 既存テーブルに新規カラムを追加
            project_columns = [col['name'] for col in inspector.get_columns('projects')]
            
            if 'color' not in project_columns:
                print("   ✅ projects.color カラムを追加中...")
                conn.execute(text("ALTER TABLE projects ADD COLUMN color VARCHAR(20) DEFAULT '#6366f1'"))
                conn.commit()
                print("   ✓ color カラムを追加しました")
            
            if 'icon' not in project_columns:
                print("   ✅ projects.icon カラムを追加中...")
                conn.execute(text("ALTER TABLE projects ADD COLUMN icon VARCHAR(50) DEFAULT 'folder'"))
                conn.commit()
                print("   ✓ icon カラムを追加しました")
        
        # ==========================================
        # 1. role_groups テーブルの作成
        # ==========================================
        existing_tables = inspector.get_table_names()
        if 'role_groups' not in existing_tables:
            print("\n✅ role_groups テーブルを作成中...")
            conn.execute(text("""
                CREATE TABLE role_groups (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(36),
                    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    color VARCHAR(20) DEFAULT '#6366f1',
                    icon VARCHAR(50) DEFAULT 'folder',
                    order_index INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX idx_role_groups_user_id ON role_groups(user_id)"))
            conn.execute(text("CREATE INDEX idx_role_groups_project_id ON role_groups(project_id)"))
            conn.commit()
            print("   ✓ role_groups テーブルを作成しました")
        else:
            print("\n⏭️ role_groups テーブルは既に存在します")
        
        # ==========================================
        # 2. task_triggers テーブルの作成
        # ==========================================
        existing_tables = inspector.get_table_names()
        if 'task_triggers' not in existing_tables:
            print("\n✅ task_triggers テーブルを作成中...")
            conn.execute(text("""
                CREATE TABLE task_triggers (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
                    trigger_time VARCHAR(10),
                    trigger_days TEXT,
                    cron_expression VARCHAR(100),
                    depends_on_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                    trigger_on_status VARCHAR(20) DEFAULT 'completed',
                    delay_minutes INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX idx_task_triggers_task_id ON task_triggers(task_id)"))
            conn.execute(text("CREATE INDEX idx_task_triggers_depends_on ON task_triggers(depends_on_task_id)"))
            conn.commit()
            print("   ✓ task_triggers テーブルを作成しました")
        else:
            print("\n⏭️ task_triggers テーブルは既に存在します")
        
        # ==========================================
        # 3. tasks テーブルに新規カラム追加
        # ==========================================
        if 'tasks' in existing_tables:
            task_columns = [col['name'] for col in inspector.get_columns('tasks')]
            print(f"\n📋 tasks テーブルの既存カラム: {task_columns}")
            
            # project_id カラム追加
            if 'project_id' not in task_columns:
                print("\n✅ tasks.project_id カラムを追加中...")
                conn.execute(text("""
                    ALTER TABLE tasks ADD COLUMN project_id INTEGER 
                    REFERENCES projects(id) ON DELETE SET NULL
                """))
                conn.commit()
                print("   ✓ project_id カラムを追加しました")
            
            # role_group_id カラム追加
            if 'role_group_id' not in task_columns:
                print("✅ tasks.role_group_id カラムを追加中...")
                # まずNULLABLE外部キーなしで追加
                conn.execute(text("ALTER TABLE tasks ADD COLUMN role_group_id INTEGER"))
                conn.commit()
                print("   ✓ role_group_id カラムを追加しました")
            
            # order_index カラム追加
            if 'order_index' not in task_columns:
                print("✅ tasks.order_index カラムを追加中...")
                conn.execute(text("ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0"))
                conn.commit()
                print("   ✓ order_index カラムを追加しました")
            
            # role_group カラム追加
            if 'role_group' not in task_columns:
                print("✅ tasks.role_group カラムを追加中...")
                conn.execute(text("ALTER TABLE tasks ADD COLUMN role_group VARCHAR(100) DEFAULT 'General'"))
                conn.commit()
                print("   ✓ role_group カラムを追加しました")
            
            # dependencies カラム追加
            if 'dependencies' not in task_columns:
                print("✅ tasks.dependencies カラムを追加中...")
                conn.execute(text("ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]'"))
                conn.commit()
                print("   ✓ dependencies カラムを追加しました")
        
        print("\n" + "=" * 50)
        print("✅ マイグレーションが完了しました！")
        print("=" * 50)
        
        # 最終確認
        print("\n📊 最終テーブル一覧:")
        inspector = inspect(engine)
        final_tables = inspector.get_table_names()
        for table in sorted(final_tables):
            columns = [col['name'] for col in inspector.get_columns(table)]
            print(f"   - {table}: {len(columns)} カラム")


if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()



