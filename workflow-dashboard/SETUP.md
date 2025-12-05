# Workflow Dashboard - セットアップガイド

Browser Useを使った自然言語AIエージェントを管理・可視化するWebダッシュボードシステム

## 🚀 クイックスタート

### 1. バックエンドのセットアップ

```bash
cd workflow-dashboard/backend

# 仮想環境を作成（まだない場合）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# Windows: venv\Scripts\activate

# 依存パッケージをインストール
pip install -r requirements.txt

# Playwrightブラウザをインストール
playwright install chromium

# 環境変数ファイルを作成
cp env.example .env

# 暗号化キーを生成して.envに設定
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 出力されたキーを .env の ENCRYPTION_KEY に設定

# APIキーを設定（.envファイルを編集）
# ANTHROPIC_API_KEY=your-actual-key-here
# GOOGLE_API_KEY=your-actual-key-here

# サーバーを起動
uvicorn app.main:app --reload --port 8000
```

### 2. フロントエンドのセットアップ

```bash
cd workflow-dashboard/frontend

# 依存パッケージをインストール
npm install

# 開発サーバーを起動
npm run dev
```

### 3. アクセス

- **フロントエンド**: http://localhost:5173 (Viteのデフォルトポート)
- **バックエンドAPI**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs

## 📋 必要なAPIキー

### 必須
- **Anthropic API Key**: Browser Useで使用（Claude API）
  - 取得: https://console.anthropic.com/

### オプション
- **Google API Key**: 動画分析機能で使用（Gemini 1.5 Pro）
  - 取得: https://makersuite.google.com/app/apikey

## 🎨 新機能（Awwwards Level Design）

- ✨ **モダンなUI**: Linear/Vercel風の洗練されたデザイン
- 🌓 **ライト/ダークモード**: デフォルトはライトモード、切り替え可能
- 🎬 **ライブビュー**: リアルタイムでブラウザ操作を監視
- 📹 **CDP Screencast**: 高品質なリアルタイム画面配信
- 🪄 **AIウィザード**: 動画から自動でタスクを生成

## 🔧 トラブルシューティング

### バックエンドが起動しない
- 仮想環境が有効化されているか確認: `which python` で `venv/bin/python` が表示されること
- ポート8000が使用中でないか確認: `lsof -i :8000`

### フロントエンドが起動しない
- Node.jsのバージョンを確認: `node --version` (18以上推奨)
- `node_modules` を削除して再インストール: `rm -rf node_modules && npm install`

### Playwrightのエラー
- ブラウザがインストールされているか確認: `playwright install chromium`
- ヘッドレスモードで実行する場合、必要な依存関係がインストールされているか確認

## 📚 詳細なドキュメント

詳細な機能説明やAPI仕様は `workflow-dashboard-full-spec-with-liveview (1).md` を参照してください。

