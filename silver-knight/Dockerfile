FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts
RUN npx prisma generate
RUN npm rebuild better-sqlite3

FROM deps AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:./data/silver-knight.db"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "src/main/server/standalone.ts"]
