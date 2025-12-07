# Workflow Dashboard

Browser Useを使った自然言語AIエージェントを管理・可視化するWebダッシュボードシステム

## 機能

- 🤖 **自然言語でブラウザ自動化**: AIに指示するだけでブラウザ操作を自動実行
- 📺 **ライブビュー**: 実行中のタスクをリアルタイムで監視（スクリーンショット + ログ）
- 🔐 **認証情報管理**: APIキー・ログイン情報を暗号化して安全に保存
- ⏰ **スケジュール実行**: cron形式でタスクを自動実行
- 📊 **実行履歴**: 全ての実行結果を記録・閲覧

## セットアップ

### 必要なもの

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose（本番環境）

### ローカル開発

#### 1. バックエンド

```bash
cd backend

# 仮想環境を作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係をインストール
pip install -r requirements.txt

# Playwrightブラウザをインストール
playwright install chromium

# 環境変数を設定（.envファイルを作成）
cp .env.example .env
# ENCRYPTION_KEY を生成:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# サーバーを起動
uvicorn app.main:app --reload --port 8000
```

#### 2. フロントエンド

```bash
cd frontend

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

#### 3. アクセス

- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- API ドキュメント: http://localhost:8000/docs

### Docker で起動

```bash
# 環境変数を設定
export ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# 起動
docker-compose up -d

# ログ確認
docker-compose logs -f
```

### Zeabur でデプロイ（推奨）

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates)

1. [Zeabur](https://zeabur.com) にログイン
2. 「New Project」→「GitHub」からこのリポジトリを選択
3. 自動的にDockerfileが検出され、ビルドが開始されます
4. 環境変数を設定：
   - `ENCRYPTION_KEY`: 暗号化キー（必須）
   - `ANTHROPIC_API_KEY`: Anthropic APIキー（推奨）
5. ドメインを生成してアクセス

**ENCRYPTION_KEYの生成方法:**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 使い方

### 1. 認証情報を追加

まず「認証情報」ページで以下を追加:

- **Anthropic API Key**: Claude APIキー（必須）
- **サイトログイン情報**: 自動化対象サイトのログイン情報

### 2. タスクを作成

「タスク」ページで新規タスクを作成:

```
タスク名: 毎朝の売上レポート

プロンプト:
楽天RMSにログインして、昨日の売上データを取得してください。
1. ログインページにアクセス
2. ログイン情報を入力してログイン
3. 売上管理メニューを開く
4. 昨日の日付で絞り込み
5. CSVをダウンロード
```

### 3. 実行

「実行」ボタンをクリックすると、ライブビューページに移動し、実行状況をリアルタイムで確認できます。

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| DATABASE_URL | データベース接続URL | sqlite:///./data/workflow.db |
| ENCRYPTION_KEY | 認証情報の暗号化キー | (必須) |
| IN_DOCKER | Docker環境フラグ | False |

## 技術スタック

### バックエンド
- FastAPI
- SQLAlchemy (SQLite)
- Browser Use + LangChain
- APScheduler

### フロントエンド
- React 18 + Vite
- Tailwind CSS
- Zustand

## ライセンス

MIT



