FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    cmake \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --no-fund --no-audit

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["node", "--experimental-quic", "src/index.js"]
