# 🚀 GitHub Actions 自動化セットアップガイド

このガイドでは、Workflow DashboardをGitHub Actionsと連携させて、
重い処理をリモートで実行する設定方法を説明します。

## 📋 アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│              Workflow Dashboard (Zeabur)                    │
│              - タスク管理UI                                  │
│              - 軽量な処理のみ担当                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                   「リモート実行」ボタン
                            │
                            ▼
              ┌─────────────────────────┐
              │   GitHub API (Dispatch)  │
              └─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions (Worker)                        │
│              - Browser Use + Claude Sonnet 4                │
│              - 7GB RAM / 最大6時間実行可能                   │
│              - 毎回クリーンな環境                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   結果をWebhookで返送     │
              │   → 実行履歴を更新        │
              └─────────────────────────┘
```

## ✅ 設定チェックリスト

### 1. GitHub Personal Access Token (PAT) の作成

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token (classic)」をクリック
3. 以下の権限を付与:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
4. トークンをコピーして安全に保管

### 2. Zeabur環境変数の設定

Zeaburダッシュボードで以下の環境変数を設定:

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `GITHUB_PAT` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx` |
| `GITHUB_REPO_OWNER` | リポジトリオーナー名 | `your-username` |
| `GITHUB_REPO_NAME` | リポジトリ名 | `自動化` または `automation` |
| `APP_URL` | ZeaburアプリのURL | `https://your-app.zeabur.app` |

### 3. GitHub Secrets の設定

リポジトリ → Settings → Secrets and variables → Actions で設定:

| Secret名 | 説明 | 取得方法 |
|----------|------|---------|
| `ANTHROPIC_API_KEY` | Anthropic APIキー | [console.anthropic.com](https://console.anthropic.com) |
| `SITE_USERNAME` | (オプション) サイトログイン用ユーザー名 | - |
| `SITE_PASSWORD` | (オプション) サイトログイン用パスワード | - |

### 4. ワークフローファイルの確認

`.github/workflows/automation.yml` がリポジトリに存在することを確認。

## 🔧 使用方法

### ダッシュボードから実行

1. タスク一覧画面で対象タスクを選択
2. 「リモート実行」ボタンをクリック
3. 実行がGitHub Actionsに送信される
4. 完了すると自動で結果が反映される

### API経由で実行

```bash
# 通常実行（サーバー上で実行）
curl -X POST "https://your-app.zeabur.app/api/tasks/{task_id}/run"

# GitHub Actions で実行（リモート）
curl -X POST "https://your-app.zeabur.app/api/tasks/{task_id}/run?use_github_actions=true"

# または専用エンドポイント
curl -X POST "https://your-app.zeabur.app/api/tasks/{task_id}/run-remote"
```

## 📊 実行状態の確認

### 1. ダッシュボードで確認
実行履歴画面で status を確認できます。

### 2. GitHub Actions で確認
リポジトリ → Actions タブで実行ログを確認できます。

### 3. API で確認
```bash
curl "https://your-app.zeabur.app/api/github-webhook/status/{execution_id}"
```

## ⚠️ 注意事項

### セキュリティ

- **認証情報の扱い**: サイトログイン情報はGitHub Secretsに保存してください
- **PAT の権限**: 必要最小限の権限のみ付与してください
- **Webhook**: 本番環境ではHTTPS必須です

### 制限事項

- GitHub Actions の無料枠: パブリックリポジトリは無制限、プライベートは月2000分
- 同時実行: 同じタスクの同時実行は1つまで（concurrencyで制御）
- タイムアウト: ワークフローは最大30分（設定変更可能）

### トラブルシューティング

#### 「GitHub Actionsが設定されていません」エラー
→ 環境変数 `GITHUB_PAT`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME` を確認

#### ワークフローが起動しない
→ GitHub PAT の権限を確認（`repo` と `workflow` が必要）

#### 結果が返ってこない
→ `APP_URL` が正しいか確認。Zeaburの公開URLを設定してください。

#### Playwright が動作しない
→ ワークフローで `playwright install` と `playwright install-deps` が実行されているか確認

## 📁 ファイル構成

```
自動化/
├── .github/
│   └── workflows/
│       └── automation.yml          # GitHub Actions ワークフロー
├── automation_script.py             # メイン自動化スクリプト
├── workflow-dashboard/
│   └── backend/
│       └── app/
│           ├── services/
│           │   └── github_actions.py   # GitHub API クライアント
│           └── routers/
│               └── github_webhook.py   # Webhook エンドポイント
└── GITHUB_ACTIONS_SETUP.md          # このファイル
```

## 🎯 推奨ユースケース

| ユースケース | 推奨実行方法 |
|-------------|-------------|
| 5分以内の軽量タスク | 通常実行（サーバー） |
| 長時間のスクレイピング | GitHub Actions |
| 大量データ処理 | GitHub Actions |
| リアルタイム監視が必要 | 通常実行（サーバー） |
| 定期実行（スケジュール） | どちらでもOK |

## 🔗 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
- [browser-use ドキュメント](https://github.com/browser-use/browser-use)
- [Anthropic API](https://docs.anthropic.com/)
