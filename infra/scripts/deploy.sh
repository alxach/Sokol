#!/bin/bash
set -euo pipefail

echo "=== SOKOL Deploy ==="

APP_DIR="/opt/sokol"
BRANCH="${1:-main}"

cd "$APP_DIR"

echo "Pulling latest changes..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Loading environment..."
set -a; source .env; set +a

echo "Building and restarting services..."
docker-compose -f infra/docker-compose.yml down
docker-compose -f infra/docker-compose.yml up -d --build

echo "Cleaning old images..."
docker image prune -f

echo "=== Deploy complete ==="
