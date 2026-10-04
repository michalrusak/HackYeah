#!/bin/sh
set -e

cd /app/apps/api

echo "[api] Applying database migrations..."
./node_modules/.bin/prisma migrate deploy --config prisma7.config.ts

echo "[api] Starting NestJS..."
exec node dist/main.js
