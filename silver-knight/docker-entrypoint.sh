#!/bin/sh
set -e

echo "[silver-knight] Waiting for PostgreSQL to be ready..."
until node -e "const net=require('net');const s=net.createConnection(5432,'db');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)" 2>/dev/null; do
  echo "[silver-knight] PostgreSQL not ready yet, retrying in 2s..."
  sleep 2
done

echo "[silver-knight] PostgreSQL is ready. Pushing schema..."
npx prisma db push --accept-data-loss

echo "[silver-knight] Schema applied. Starting Express server..."
exec npx tsx src/server/standalone.ts
