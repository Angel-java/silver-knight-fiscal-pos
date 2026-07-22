FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts
RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=postgresql://silverknight:REDACTED_DB_PASS@db:5432/silverknight?schema=public

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package.json ./
COPY tsconfig.json tsconfig.node.json ./
COPY src/server ./src/server

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
