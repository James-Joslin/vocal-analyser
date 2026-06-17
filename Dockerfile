# ---------------------------------------------------------
# Base Stage — Node.js for the React/Vite frontend + Express
# ---------------------------------------------------------
FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------
# Development Stage
# ---------------------------------------------------------
FROM base AS development

# Source is bind-mounted via docker-compose volumes, so no COPY needed.
# Container stays alive via `tail`; exec in to run manually:
#
#   npm run dev        →  Vite dev server + Express proxy
#   npm run build      →  production bundle
#   npx tsc --noEmit   →  type-check

EXPOSE 3001

CMD ["tail", "-f", "/dev/null"]

# ---------------------------------------------------------
# Production Stage
# ---------------------------------------------------------
FROM base AS production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]