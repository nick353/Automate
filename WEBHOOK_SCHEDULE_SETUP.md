# Webhookトリガー・スケジュール機能 セットアップガイド

## 🎉 新機能の概要

このツールに以下の機能が追加されました：

### 1. **スケジュール実行**
- プリセットから簡単設定（毎日9時、毎時間、5分ごとなど）
- Cron形式でのカスタム設定
- 次回実行時刻のプレビュー表示

### 2. **Webhookトリガー**
- LINE通知を受け取ったときに自動実行
- 任意のウェブサイトからHTTPリクエストで実行
- Zapier、Make.comなどのツールと連携可能

### 3. **GitHub Actions統合**
- メモリリークなし（毎回新品の環境）
- 自動キューイング（複数タスクの並列実行管理）
- 最大6時間のタイムアウト

---

## 📋 セットアップ手順

### Step 1: スケジュール実行の設定

1. **タスク作成画面でスケジュール設定**
   - タスクフォーム内の「スケジュール」欄の横にある「ヘルパー」ボタンをクリック
   - プリセットから選択（毎日9時、平日9時など）
   - または、Cron形式で入力（例: `0 9 * * *`）

2. **次回実行時刻の確認**
   - スケジュールヘルパー画面で自動計算された次回実行時刻が表示されます

3. **保存して完了**
   - タスクを保存すると、自動的にスケジューラーに登録されます

#### Cron形式の例
```
*/5 * * * *   # 5分ごと
0 * * * *     # 毎時0分
0 9 * * *     # 毎日9時
0 9 * * 1-5   # 平日9時
0 9 * * 1     # 毎週月曜9時
```

---

### Step 2: Webhookトリガーの設定

#### 2-1. Webhook URLの取得

1. **タスク一覧画面**でタスクカードの「🔗 Webhook」ボタンをクリック
2. **Webhookトリガー管理画面**が開きます
3. 2種類のURLが表示されます：
   - **汎用Webhook**: 任意のサービスから呼び出し可能
   - **LINE Webhook**: LINE専用

#### 2-2. LINE Notifyとの連携

1. [LINE Notify](https://notify-bot.line.me/my/) にアクセス
2. 「マイページ」→「トークンを発行する」
3. Webhook URLに上記の「LINE Webhook URL」を貼り付け
4. LINEから通知を受け取ると、自動的にタスクが実行されます

#### 2-3. 汎用Webhookの使用例

```bash
# cURLでテスト
curl -X POST https://your-domain.com/api/webhook/trigger/123/456 \
  -H "Content-Type: application/json" \
  -d '{"message": "Triggered from external source"}'
```

**対応サービス:**
- Zapier（Webhook by Zapier）
- Make.com（HTTP Request）
- Discord Webhook
- Slack Incoming Webhooks
- 任意のHTTPクライアント

---

### Step 3: GitHub Actions統合の設定（推奨）

GitHub Actionsを使うと、Zeaburのメモリ制約やタイムアウトを回避できます。

#### 3-1. GitHubリポジトリの準備

1. **リポジトリを作成**（既存のリポジトリでもOK）
   ```bash
   cd /path/to/your/repo
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **必要なファイルが含まれているか確認**
   - `.github/workflows/automation.yml`（すでに存在）
   - `automation_script.py`（すでに存在）

#### 3-2. GitHub Secretsの設定

1. GitHubリポジトリページで **Settings** → **Secrets and variables** → **Actions**
2. 以下のシークレットを追加：

| シークレット名 | 値 |
|---|---|
| `ANTHROPIC_API_KEY` | あなたのAnthropic APIキー |
| `SITE_USERNAME` | （オプション）ログインが必要なサイトのユーザー名 |
| `SITE_PASSWORD` | （オプション）ログインが必要なサイトのパスワード |

#### 3-3. Zeabur環境変数の設定

Zeaburのダッシュボードで以下の環境変数を設定：

| 環境変数名 | 値 | 説明 |
|---|---|---|
| `GITHUB_PAT` | GitHub Personal Access Token | [こちら](https://github.com/settings/tokens)で作成 |
| `GITHUB_REPO_OWNER` | あなたのGitHubユーザー名 | 例: `nichikatanaka` |
| `GITHUB_REPO_NAME` | リポジトリ名 | 例: `workflow-automation` |
| `APP_URL` | ZeaburのアプリURL | 例: `https://your-app.zeabur.app` |

#### 3-4. GitHub Personal Access Tokenの作成

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)** をクリック
3. スコープで以下を選択：
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
4. トークンをコピーして`GITHUB_PAT`に設定

#### 3-5. タスクをGitHub Actionsで実行

**方法1: APIから実行**
```javascript
await tasksApi.run(taskId, { use_github_actions: true })
```

**方法2: 専用エンドポイント（推奨）**
```javascript
const response = await fetch(`/api/tasks/${taskId}/run-remote`, {
  method: 'POST'
})
```

---

## 🎯 使用例

### 例1: 毎朝9時にニュースを取得

1. タスク作成時にスケジュールを`0 9 * * *`に設定
2. 保存すると自動的に毎日9時に実行されます

### 例2: LINEで「価格チェック」と送信したらAmazon価格監視

1. タスクを作成（名前: 「Amazon価格監視」）
2. Webhookボタンからウィンドウを開く
3. LINE Webhook URLをコピー
4. LINE Notifyに登録
5. LINEグループに「価格チェック」と送信すると自動実行

### 例3: Zapierで「新しいメール受信時に情報抽出」

1. タスクを作成（名前: 「メール情報抽出」）
2. Webhookボタンから汎用Webhook URLをコピー
3. Zapierで「Trigger: Gmail - New Email」を設定
4. Action: Webhooks by Zapier → POST Request
5. URLに汎用Webhook URLを貼り付け

---

## 🔐 セキュリティに関する注意

### Webhook URLの管理
- ✅ **DO**: Webhook URLを信頼できるサービスのみに共有
- ❌ **DON'T**: 公開されたコードやドキュメントにURLを記載しない

### タスクの有効/無効
- タスクが無効化されている場合、WebhookもスケジュールもすべてOFFになります
- セキュリティ上、不要なタスクは無効化または削除してください

---

## 🚀 GitHub Actionsのメリット

| 項目 | Zeabur直接実行 | GitHub Actions |
|---|---|---|
| メモリ | 512MB（制限あり） | 7GB |
| タイムアウト | 30秒〜数分 | 最大6時間 |
| 環境 | 同じコンテナで連続実行 | 毎回新品の環境 |
| 並列実行 | 衝突の可能性 | 自動キューイング |
| ブラウザクラッシュ対策 | 手動再起動が必要 | 自動回復 |

---

## ❓ トラブルシューティング

### Q1: スケジュールが実行されない
- タスクが「有効」になっているか確認
- Zeaburのログで`scheduler_service.start()`が成功しているか確認
- Cron形式が正しいか確認（[crontab.guru](https://crontab.guru/)で検証）

### Q2: Webhook URLにアクセスしても404エラー
- `/api/webhook/trigger/{task_id}/{trigger_id}` の形式が正しいか確認
- タスクIDとトリガーIDが存在するか確認
- `main.py`で`webhook_triggers.router`が登録されているか確認

### Q3: GitHub Actionsが起動しない
- `GITHUB_PAT`が正しく設定されているか確認
- Personal Access Tokenのスコープに`repo`と`workflow`が含まれているか確認
- GitHubリポジトリが存在し、`.github/workflows/automation.yml`があるか確認

### Q4: GitHub Actionsで「ANTHROPIC_API_KEY is not set」エラー
- GitHubリポジトリのSecretsに`ANTHROPIC_API_KEY`を追加
- Zeabur側ではなく、**GitHub側のSecrets**に設定する必要があります

---

## 📊 実装状況

✅ **完全実装済み**
- Webhookトリガー（汎用、LINE対応）
- スケジュールヘルパーUI（プリセット、Cron、次回実行時刻表示）
- トリガー管理UI（Webhook URL表示、テスト実行）
- GitHub Actions統合（repository_dispatch、結果Webhook）
- バックエンドAPI（`webhook_triggers.py`, `github_actions.py`）
- フロントエンドコンポーネント（`ScheduleHelper.jsx`, `WebhookTriggerManager.jsx`）

---

以上で、あなたの自動化ツールが**完全な定期実行・外部トリガー対応システム**になりました！🎉
