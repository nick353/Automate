# ============================================
# Stage 1: フロントエンドのビルド
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# 依存関係をインストール
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# フロントエンドをビルド
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: バックエンド + フロントエンド統合
# ============================================
FROM python:3.11-slim-bookworm

# 環境変数でデバッグを無効化
ENV DEBIAN_FRONTEND=noninteractive

# Playwrightの依存関係をインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Python依存関係をインストール
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwrightブラウザをインストール
RUN playwright install chromium

# バックエンドアプリケーションをコピー
COPY backend/ .

# フロントエンドのビルド成果物をコピー
COPY --from=frontend-builder /frontend/dist /app/static

# ディレクトリを作成
RUN mkdir -p screenshots uploads data logs

# 環境変数
ENV IN_DOCKER=True
ENV PYTHONUNBUFFERED=1
ENV SERVE_FRONTEND=True

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]




