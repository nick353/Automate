FROM node:20-alpine as builder

WORKDIR /app

# 依存関係をインストール
COPY package*.json ./
RUN npm install

# ビルド
COPY . .
RUN npm run build

# 本番用イメージ
FROM nginx:alpine

# envsubstをインストール（環境変数置換用）
RUN apk add --no-cache gettext

# カスタムnginx設定をコピー（テンプレートとして）
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# 環境変数をデフォルト値として設定
ENV BACKEND_URL=http://backend:8000

CMD ["/bin/sh", "-c", "envsubst '$$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]



