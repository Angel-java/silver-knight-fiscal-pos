#!/bin/sh
set -e

echo "[silver-knight] Waiting for PostgreSQL to be ready..."
until npx prisma db pull --print >/dev/null 2>&1; do
  echo "[silver-knight] PostgreSQL not ready yet, retrying in 2s..."
  sleep 2
done

echo "[silver-knight] PostgreSQL is ready. Running migrations..."
npx prisma migrate deploy

echo "[silver-knight] Migrations applied. Starting Express server..."
exec npx tsx src/server/standalone.ts
