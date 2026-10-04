#!/bin/sh
# Idempotentny seed produkcyjny — bezpieczny przy każdym restarcie API.
set -e

cd /app/apps/api

echo "[api] Seeding Kreator pomysłów (fiszki + nabory)..."
node prisma/seed.mjs

echo "[api] Seeding Zasobnik wiedzy..."
node dist/modules/knowledge/seed.js

echo "[api] Seeding profile testerów innowacji..."
node dist/database/testers-db.cli.js seed

echo "[api] Pełny seed zakończony."
