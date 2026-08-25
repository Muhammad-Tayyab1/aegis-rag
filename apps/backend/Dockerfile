# onnxruntime-node (used by the local cross-encoder) publishes glibc binaries.
# Debian slim keeps the image compact while providing the required loader.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm run prisma:generate && npm run build --workspace=@aegis-rag/backend
CMD ["npm","run","start","--workspace=@aegis-rag/backend"]
