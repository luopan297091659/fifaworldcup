#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm install --omit=dev
npm run db:init

if pm2 describe fifaworldcup-api >/dev/null 2>&1; then
  pm2 reload fifaworldcup-api --update-env
else
  pm2 start ecosystem.config.js --update-env
fi

pm2 save
