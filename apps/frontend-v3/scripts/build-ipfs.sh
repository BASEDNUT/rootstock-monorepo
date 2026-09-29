#!/usr/bin/env bash
# Rootstock IPFS export - full static site in out/
# S102 (Boss 2026-09-26, boat integrity): dev/demo surfaces never bake into
# the export. Same reversible stash pattern as app/api.
set -euo pipefail
cd "$(dirname "$0")/.."

API_DIR=app/api
API_STASH=.ipfs-stash-api

# S102 dev surfaces — leak laws in export-laws.spec.ts:
#   debug/      12 demo pages incl wallet-impersonate
#   testooors/  zen test page (upstream testnet pool deep-links)
#   vebal/      upstream governance surface (targets upstream MAINNET contracts)
#   pools/cow/  upstream CoW AMM orphan (no cow pools on our chain)
#   components/ Chakra component showcase (marketing demo)
DEV_SURFACE_DIRS=(
  'app/(app)/debug'
  'app/(app)/testooors'
  'app/(app)/vebal'
  'app/(app)/pools/cow'
  'app/(marketing)/components'
)
DEV_SURFACE_STASH=.ipfs-stash-dev-surfaces

if [ -d "$API_DIR" ]; then
  rm -rf "$API_STASH"
  mv "$API_DIR" "$API_STASH"
  echo "[ipfs] app/api moved aside"
fi

rm -rf "$DEV_SURFACE_STASH"
mkdir -p "$DEV_SURFACE_STASH"
for d in "${DEV_SURFACE_DIRS[@]}"; do
  if [ -d "$d" ]; then
    # preserve parent path inside stash
    mkdir -p "$DEV_SURFACE_STASH/$(dirname "$d")"
    mv "$d" "$DEV_SURFACE_STASH/$d"
    echo "[ipfs] dev surface moved aside: $d"
  fi
done

export ROOTSTOCK_EXPORT=1
export CI=true

pnpm --filter @repo/lib graphql:gen
npx next build

if [ -d "$API_STASH" ]; then
  mv "$API_STASH" "$API_DIR"
  echo "[ipfs] app/api restored"
fi

if [ -d "$DEV_SURFACE_STASH" ]; then
  # restore each stashed dir back to its original parent
  for d in "${DEV_SURFACE_DIRS[@]}"; do
    if [ -d "$DEV_SURFACE_STASH/$d" ]; then
      mkdir -p "$(dirname "$d")"
      mv "$DEV_SURFACE_STASH/$d" "$d"
    fi
  done
  rm -rf "$DEV_SURFACE_STASH"
  echo "[ipfs] dev surfaces restored"
fi

echo "[ipfs] DONE - static site in out/"
