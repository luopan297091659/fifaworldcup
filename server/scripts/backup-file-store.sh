#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p data/backups
if [ -f data/store.json ]; then
  cp data/store.json "data/backups/store.$(date +%Y%m%d%H%M%S).json"
  echo "backup written to data/backups"
else
  echo "data/store.json not found"
fi
