# AIモデル使用状況

## 📊 機能別使用モデル

### 1. チャット機能（タスク作成・編集）
**使用モデル**: Claude Sonnet 4.5 🆕
- **ファイル**: `project_chat.py`, `wizard_chat.py`
- **理由**: 世界最高レベルのコーディングモデル、複雑なタスクを30時間以上実行可能
- **APIキー**: Anthropic API Key
- **モデルID**: `claude-sonnet-4-5-20250929`（2025年9月版）

---

### 2. ブラウザ自動化（Browser Use）
**使用モデル**: GPT-4o（優先） / Claude Sonnet 4.5（フォールバック）
- **ファイル**: `agent.py`
- **理由**: 画面の視覚認識が必須（ビジョンモデル）
- **APIキー**: OpenAI API Key（推奨） または Anthropic API Key
- **優先順位**:
  1. OpenAI GPT-4o（推奨）← **視覚認識対応**
  2. Anthropic Claude Sonnet 4.5（フォールバック）

---

### 3. 動画分析（録画からタスク生成）
**使用モデル**: Gemini 1.5 Pro
- **ファイル**: `video_analyzer.py`
- **理由**: 長時間動画の処理に最適
- **APIキー**: Google API Key
- **機能**:
  - 動画から操作ステップを分析
  - タスクプロンプトを自動生成
  - API代替可能性の提案

---

### 4. 画像分析
**使用モデル**: 未確認
- **確認中**: `project_chat.py`内の画像分析機能
- **推奨**: GPT-4o（視覚認識）

---

## 🔧 推奨設定

### 最低限必要なAPIキー
```
Anthropic API Key  → チャット機能用
OpenAI API Key     → ブラウザ自動化用（視覚認識必須）
```

### フル機能を使う場合
```
Anthropic API Key  → チャット機能
OpenAI API Key     → ブラウザ自動化・画像分析
Google API Key     → 動画分析
```

---

## 💡 なぜこの組み合わせ？

| 機能 | モデル | 理由 |
|------|--------|------|
| チャット | Claude Sonnet 4.5 🆕 | 世界最高レベルのコーディング能力、30時間以上の長時間実行可能 |
| ブラウザ自動化 | GPT-4o | **視覚認識**が必須（画面を見て操作） |
| 動画分析 | Gemini 1.5 Pro | 長時間動画の処理が得意 |

---

## ⚙️ モデル変更方法

### チャットをGPT-4oに変更したい場合
`backend/app/services/project_chat.py`の15行目を変更：
```python
# 現在
from app.services.anthropic_client import call_anthropic_api

# GPT-4oに変更
from app.services.openai_client import call_openai_api
```

### ブラウザ自動化をClaude専用にしたい場合（非推奨）
`backend/app/services/agent.py`の56-71行を変更して、Anthropic優先に

---

## 📌 重要な注意

**ブラウザ自動化には視覚認識が必須です！**

Browser Useは画面を「見て」操作するため、ビジョンモデル（GPT-4o等）が必須です。
Claude 3.5 Sonnetもビジョン対応していますが、GPT-4oが推奨されています。

