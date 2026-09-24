#!/usr/bin/env bash
# Rootstock IPFS export (TODO 5.10) - full static site in out/
set -euo pipefail
cd "$(dirname "$0")/.."

API_DIR=app/api
API_STASH=.ipfs-stash-api

if [ -d "$API_DIR" ]; then
  rm -rf "$API_STASH"
  mv "$API_DIR" "$API_STASH"
  echo "[ipfs] app/api moved aside"
fi

export ROOTSTOCK_EXPORT=1
export CI=true

pnpm --filter @repo/lib graphql:gen
npx next build

if [ -d "$API_STASH" ]; then
  mv "$API_STASH" "$API_DIR"
  echo "[ipfs] app/api restored"
fi

echo "[ipfs] DONE - static site in out/"
