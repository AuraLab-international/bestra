FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG PUBLIC_SERVER_IP
ENV PUBLIC_SERVER_IP=$PUBLIC_SERVER_IP

RUN npm run build


FROM nginx:alpine

RUN apk upgrade --no-cache

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/web/index.html /usr/share/nginx/html/index.html

COPY --from=builder \
    /app/node_modules/@lynx-js/web-core/dist/client_prod \
    /usr/share/nginx/html/lynx-web-core

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
