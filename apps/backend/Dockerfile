FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install
COPY . .
RUN npm run prisma:generate && npm run build --workspace=@aegis-rag/backend
CMD ["npm","run","start","--workspace=@aegis-rag/backend"]
