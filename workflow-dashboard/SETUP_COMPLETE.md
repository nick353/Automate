# ✅ セットアップ完了チェックリスト

## 完了した項目

- ✅ フロントエンド依存パッケージのインストール（framer-motion含む）
- ✅ バックエンド依存パッケージの確認（主要パッケージはインストール済み）
- ✅ .envファイルの作成

## 🔧 次に必要な作業

### 1. 暗号化キーの設定

`.env`ファイルの`ENCRYPTION_KEY`を設定してください：

```bash
cd workflow-dashboard/backend
source venv/bin/activate
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

出力されたキーを`.env`ファイルの`ENCRYPTION_KEY=`の後に貼り付けてください。

### 2. APIキーの設定

`.env`ファイルを編集して、以下のAPIキーを設定してください：

```bash
# 必須
ANTHROPIC_API_KEY=your-actual-anthropic-api-key-here

# オプション（動画分析機能を使用する場合）
GOOGLE_API_KEY=your-actual-google-api-key-here
```

**APIキーの取得方法：**
- **Anthropic API Key**: https://console.anthropic.com/ でアカウント作成後、APIキーを生成
- **Google API Key**: https://makersuite.google.com/app/apikey でAPIキーを生成

### 3. アプリケーションの起動

#### バックエンド（ターミナル1）
```bash
cd workflow-dashboard/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

#### フロントエンド（ターミナル2）
```bash
cd workflow-dashboard/frontend
npm run dev
```

### 4. アクセス

- **フロントエンド**: http://localhost:5173
- **バックエンドAPI**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs

## 🎉 準備完了！

これで、Awwwardsレベルのワークフロー管理ダッシュボードが使用可能です！

**最初のステップ：**
1. フロントエンドにアクセス
2. 「認証情報」ページでAnthropic APIキーを追加
3. 「タスク」ページで最初のタスクを作成
4. 「実行」ボタンでタスクを実行し、ライブビューを確認！

