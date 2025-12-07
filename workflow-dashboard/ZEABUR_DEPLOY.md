# Zeaburへのデプロイ手順

このドキュメントでは、Workflow DashboardをZeaburにデプロイする手順を説明します。

## 前提条件

- Zeaburアカウント（[https://zeabur.com](https://zeabur.com)）
- GitHubリポジトリにコードがプッシュされていること

## デプロイ方法

### 方法1: Zeabur Web UIを使用（推奨）

1. **Zeaburにログイン**
   - [https://zeabur.com](https://zeabur.com) にアクセスしてログイン

2. **新しいプロジェクトを作成**
   - ダッシュボードで「New Project」をクリック
   - プロジェクト名を入力

3. **バックエンドサービスを追加**
   - 「Add Service」→「GitHub」を選択
   - リポジトリを選択
   - **Root Directory**: `workflow-dashboard/backend` を指定
   - **Build Command**: （自動検出）
   - **Start Command**: （自動検出）

4. **環境変数を設定**
   バックエンドサービスで以下の環境変数を設定：
   
   | 変数名 | 説明 | 必須 | デフォルト |
   |--------|------|------|-----------|
   | `ENCRYPTION_KEY` | 認証情報の暗号化キー | ✅ | - |
   | `DATABASE_URL` | データベース接続URL | ❌ | `sqlite:///./data/workflow.db` |
   | `ANTHROPIC_API_KEY` | Anthropic APIキー | ❌ | - |
   | `GOOGLE_API_KEY` | Google APIキー | ❌ | - |
   | `BROWSER_USE_API_KEY` | Browser Use APIキー | ❌ | - |
   | `OAGI_API_KEY` | OAGI APIキー | ❌ | - |
   | `IN_DOCKER` | Docker環境フラグ | ❌ | `True` |
   | `SUPABASE_URL` | Supabase URL | ❌ | （デフォルト値あり） |
   | `SUPABASE_ANON_KEY` | Supabase匿名キー | ❌ | （デフォルト値あり） |

   **ENCRYPTION_KEYの生成方法:**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

5. **フロントエンドサービスを追加**
   - 「Add Service」→「GitHub」を選択
   - 同じリポジトリを選択
   - **Root Directory**: `workflow-dashboard/frontend` を指定
   - **Build Command**: （自動検出）
   - **Start Command**: （自動検出）

6. **フロントエンドの環境変数を設定**
   - `BACKEND_URL`: バックエンドサービスのURL（Zeaburが自動的に提供する内部URLを使用）
   - Zeaburでは、サービス間の通信に内部URLを使用します
   - バックエンドサービスの「Service URL」をコピーして `BACKEND_URL` に設定

7. **ドメインを設定**
   - フロントエンドサービスで「Domains」を開く
   - 「Generate Domain」をクリックしてドメインを生成
   - または、カスタムドメインを設定

### 方法2: Zeabur CLIを使用

1. **Zeabur CLIをインストール**
   ```bash
   npm install -g @zeabur/cli
   ```

2. **ログイン**
   ```bash
   zeabur login
   ```

3. **プロジェクトを作成**
   ```bash
   zeabur project create workflow-dashboard
   ```

4. **サービスをデプロイ**
   ```bash
   # バックエンド
   cd workflow-dashboard/backend
   zeabur service create --project workflow-dashboard --name backend
   
   # フロントエンド
   cd ../frontend
   zeabur service create --project workflow-dashboard --name frontend
   ```

5. **環境変数を設定**
   ```bash
   # バックエンドの環境変数
   zeabur env set ENCRYPTION_KEY="your-encryption-key" --service backend
   zeabur env set ANTHROPIC_API_KEY="your-api-key" --service backend
   
   # フロントエンドの環境変数（バックエンドURLは後で設定）
   zeabur env set BACKEND_URL="http://backend:8000" --service frontend
   ```

### 方法3: zeabur.yamlテンプレートを使用（上級者向け）

1. **リポジトリにzeabur.yamlをコミット**
   ```bash
   git add zeabur.yaml
   git commit -m "Add Zeabur deployment configuration"
   git push
   ```

2. **Zeabur CLIでデプロイ**
   ```bash
   zeabur template deploy -f workflow-dashboard/zeabur.yaml
   ```

## 重要な設定

### バックエンドのリソース設定

ZeaburのWeb UIで、バックエンドサービスに以下のリソースを割り当てることを推奨：

- **CPU**: 2000m（2コア）
- **メモリ**: 4096MB（4GB）

PlaywrightとChromiumを使用するため、十分なメモリが必要です。

### データベースの選択

本番環境では、SQLiteではなくPostgreSQLの使用を推奨します：

1. ZeaburでPostgreSQLサービスを追加
2. `DATABASE_URL` 環境変数に接続URLを設定
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```

### フロントエンドとバックエンドの接続

Zeaburでは、サービス間の通信に内部URLを使用します。フロントエンドの `BACKEND_URL` 環境変数には、バックエンドサービスの内部URLを設定してください。

ZeaburのWeb UIで：
1. バックエンドサービスの「Service URL」を確認
2. フロントエンドサービスの環境変数 `BACKEND_URL` にそのURLを設定

## トラブルシューティング

### バックエンドが起動しない

- **メモリ不足**: リソースを増やしてください（最低4GB推奨）
- **環境変数エラー**: `ENCRYPTION_KEY` が設定されているか確認
- **ポートエラー**: ポート8000が正しく公開されているか確認

### フロントエンドがバックエンドに接続できない

- **BACKEND_URL**: バックエンドサービスの正しいURLが設定されているか確認
- **CORS設定**: バックエンドのCORS設定を確認（`config.py`の`cors_origins`）

### Playwright/Chromiumのエラー

- **メモリ不足**: バックエンドのメモリを増やす
- **依存関係**: Dockerfileに必要な依存関係が含まれているか確認

## デプロイ後の確認

1. **ヘルスチェック**
   - バックエンド: `https://your-backend-url.zeabur.app/health`
   - レスポンス: `{"status": "healthy"}`

2. **フロントエンド**
   - ブラウザでフロントエンドのURLにアクセス
   - ログインページが表示されることを確認

3. **API接続**
   - ブラウザの開発者ツールでネットワークタブを確認
   - `/api` へのリクエストが成功しているか確認

## 参考リンク

- [Zeabur公式ドキュメント](https://zeabur.com/docs)
- [Zeabur GitHub](https://github.com/zeabur/zeabur)
