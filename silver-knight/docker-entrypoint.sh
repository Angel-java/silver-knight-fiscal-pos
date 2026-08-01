#!/bin/sh
set -e

SCHEMA_STATE_DIR=/schema-state
SCHEMA_HASH_FILE="$SCHEMA_STATE_DIR/schema-hash"

mkdir -p "$SCHEMA_STATE_DIR"
SCHEMA_HASH=$(sha256sum prisma/schema.prisma | awk '{print $1}')
LAST_HASH=""
if [ -f "$SCHEMA_HASH_FILE" ]; then
  LAST_HASH=$(cat "$SCHEMA_HASH_FILE")
fi

echo "[silver-knight] Waiting for PostgreSQL to be ready..."
until node -e "const net=require('net');const s=net.createConnection(5432,'db');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)" 2>/dev/null; do
  echo "[silver-knight] PostgreSQL not ready yet, retrying in 2s..."
  sleep 2
done

echo "[silver-knight] PostgreSQL is ready."
if [ "$SCHEMA_HASH" = "$LAST_HASH" ]; then
  echo "[silver-knight] Schema unchanged, skipping prisma db push."
else
  echo "[silver-knight] Schema changed (or first run). Pushing schema..."
  if ! npx prisma db push --accept-data-loss 2>&1; then
    rc=$?
    echo "[silver-knight] ERROR: prisma db push fallo con exit code $rc"
    exit $rc
  fi
  if ! echo "$SCHEMA_HASH" > "$SCHEMA_HASH_FILE"; then
    echo "[silver-knight] ERROR: no se pudo escribir el hash de schema (volumen /schema-state no escribible)"
    exit 1
  fi
  echo "[silver-knight] Schema applied."
fi

echo "[silver-knight] Starting Express server..."
exec npx tsx src/server/standalone.ts
