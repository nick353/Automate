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

# カスタムnginx設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
