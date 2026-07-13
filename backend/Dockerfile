FROM docker.io/ubuntu:noble

WORKDIR /app

# Install Node.js 24 and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    ffmpeg \
    libvips-dev \
    cmake \
    build-essential \
    git \
    python3 \
    pkg-config \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the database schema is in sync and generate client
RUN npx prisma generate

EXPOSE 3000
EXPOSE 4433/udp

# Run db push before starting to ensure the 'username' column exists
CMD npx prisma db push --accept-data-loss && npm run dev
