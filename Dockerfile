# ---------------------------------------------------------
# Base Stage
# ---------------------------------------------------------
FROM node:20 AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ---------------------------------------------------------
# Development Stage
# ---------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    procps \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 3001

CMD ["npm", "run", "dev"]

# ---------------------------------------------------------
# Builder Stage
# ---------------------------------------------------------
FROM base AS builder

COPY . .
RUN npm run build

# ---------------------------------------------------------
# Production Stage
# ---------------------------------------------------------
FROM node:20-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN npm ci --omit=dev

EXPOSE 3001

CMD ["npm", "run", "start"]