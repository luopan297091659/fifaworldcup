#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit it before production use."
fi

npm install --omit=dev
npm run db:init
pm2 start ecosystem.config.js --update-env
pm2 save
