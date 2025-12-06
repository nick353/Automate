# Workflow Dashboard - セットアップガイド

Browser Use（Webブラウザ自動化）と Lux/OAGI（デスクトップ自動化）を使った自然言語AIエージェントを管理・可視化するWebダッシュボードシステム

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
- **OAGI (Lux) API Key**: デスクトップ自動化で使用
  - 取得: https://developer.agiopen.org/

## 🖥️ デスクトップ自動化 (Lux) のセットアップ

Luxを使用してPC全体を自動操作する場合は、追加のセットアップが必要です。

### 1. OAGI SDKのインストール

```bash
# 全機能インストール（推奨）
pip install oagi

# または個別インストール
pip install oagi-core[desktop]
```

### 2. APIキーの取得

1. [OpenAGI Developer Console](https://developer.agiopen.org/) にアクセス
2. アカウントを作成/ログイン
3. API Keyを生成
4. ダッシュボードの「認証情報」から OAGI (Lux) API Key として登録

### 3. システム権限の設定（macOS）

Luxはスクリーンショット取得とマウス/キーボード操作を行うため、システム権限が必要です。

```bash
# 権限チェックコマンド
oagi agent permission
```

必要な権限：
- **画面収録**: システム環境設定 → セキュリティとプライバシー → プライバシー → 画面収録
- **アクセシビリティ**: システム環境設定 → セキュリティとプライバシー → プライバシー → アクセシビリティ

ターミナルまたはPythonインタプリタに権限を付与してください。

### 4. タスクの作成

1. ダッシュボードで「新規タスク」をクリック
2. **実行タイプ**で「デスクトップ」を選択
3. 自然言語で操作内容を記述

```
例: Finderを開いて、デスクトップフォルダに「新しいフォルダ」を作成する
```

### 5. 実行モデルの選択

Luxには3つのモデルがあります：
- **Actor**: 短いタスク向け（高速）
- **Thinker**: 複雑なタスク向け（推論重視）
- **Tasker**: 事前定義ワークフロー

CLIでテストする場合：
```bash
oagi agent run "Google で天気を検索" --model lux-actor-1
```

## 🎨 主要機能

- ✨ **モダンなUI**: Linear/Vercel風の洗練されたデザイン
- 🌓 **ライト/ダークモード**: デフォルトはライトモード、切り替え可能
- 🎬 **ライブビュー**: リアルタイムでブラウザ/デスクトップ操作を監視
- 📹 **CDP Screencast**: 高品質なリアルタイム画面配信
- 🪄 **AIウィザード**: 動画から自動でタスクを生成
- 🌐 **Web自動化**: Browser Use でブラウザを自動操作
- 🖥️ **デスクトップ自動化**: Lux/OAGI でPC全体を自動操作
- 🔀 **ハイブリッドモード**: WebとデスクトップをMIXした自動化

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

## 🔄 データベースマイグレーション

Lux機能を追加した場合、既存のデータベースにマイグレーションが必要です：

```bash
cd workflow-dashboard/backend
python3 migrate_lux.py
```

## 📚 アーキテクチャ

```
┌─────────────────┐     ┌──────────────────┐
│    Frontend     │────▶│     Backend      │
│   (React/Vite)  │     │    (FastAPI)     │
└─────────────────┘     └──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Browser Use │  │  Lux (OAGI)  │  │   Hybrid     │
     │ (Web自動化)   │  │(Desktop自動化)│  │   (両方)     │
     └──────────────┘  └──────────────┘  └──────────────┘
              │                │
              ▼                ▼
     ┌──────────────┐  ┌──────────────┐
     │  Playwright  │  │  PyAutoGUI   │
     │   Browser    │  │   Screen     │
     └──────────────┘  └──────────────┘
```


