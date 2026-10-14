#!/usr/bin/env bash
# Rootstock IPFS export - full static site in out/
# Dev/demo surfaces never bake into the export.
# Same reversible stash pattern as app/api.
set -euo pipefail
cd "$(dirname "$0")/.."

API_DIR=app/api
API_STASH=.ipfs-stash-api

# dev surfaces — leak laws in export-laws.spec.ts:
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

# full-page links on the ship. The static export has no server for
# client-transition RSC payloads — next/link clicks dead-end on gateways.
# turbopack resolveAlias for the next-internal 'next/link' module fails
# silently (verified zero data-ipfs-link baked, relative AND absolute
# forms), so the export build rewrites next/link imports to the IpfsLink
# full-page anchor. Originals are stashed (flat + manifest) and restored on
# both the normal path and the EXIT trap — same reversible pattern as the
# dev-surface stash.
LINK_IMPORT_STASH=.ipfs-stash-link-imports

rewrite_link_imports() {
  rm -rf "$LINK_IMPORT_STASH"
  mkdir -p "$LINK_IMPORT_STASH"
  : > "$LINK_IMPORT_STASH/.manifest"
  local count=0 f
  while IFS= read -r -d '' f; do
    count=$((count+1))
    cp "$f" "$LINK_IMPORT_STASH/$count.src"
    printf '%s\n' "$f" >> "$LINK_IMPORT_STASH/.manifest"
    sed -i -e "s|'next/link'|'@repo/lib/shared/components/ipfs/IpfsLink'|g" \
      -e 's|"next/link"|"@repo/lib/shared/components/ipfs/IpfsLink"|g' "$f"
  done < <(grep -rl -e "from 'next/link'" -e 'from "next/link"' \
    ../../packages/lib ./app ./lib --include='*.ts' --include='*.tsx' -Z \
    2>/dev/null || true)
  echo "[ipfs] next/link -> IpfsLink rewritten in $count files"

  # Guard: a zero rewrite count is a build defect, never a pass. The
  # search roots once collapsed to a single bogus path and the rewrite
  # silently no-oped behind the || true — a real export always rewrites
  # a positive count.
  if (( count == 0 )); then
    echo "ERROR: no next/link imports found to rewrite — check the search roots" >&2
    exit 1
  fi
}

restore_link_imports() {
  if [ -d "$LINK_IMPORT_STASH" ] && [ -s "$LINK_IMPORT_STASH/.manifest" ]; then
    local n=0 f
    while IFS= read -r f; do
      n=$((n+1))
      cp "$LINK_IMPORT_STASH/$n.src" "$f"
    done < "$LINK_IMPORT_STASH/.manifest"
    rm -rf "$LINK_IMPORT_STASH"
    echo "[ipfs] link imports restored"
  fi
}

# failure-safe restore — set -e exits leave stashes aside (error
# class: first main export build failure stranded app/api + dev surfaces).
restore_all() {
  restore_link_imports
  if [ -d "$API_STASH" ]; then
    mv "$API_STASH" "$API_DIR"
    # Next.js DOES copy public/.well-known -> out/.well-known (verified:
    # out/.well-known/security.txt exists post-build). The dotfile law is at
    # PIN time: `ipfs add` skips dotfiles by default — always pin with --hidden.
    echo "[ipfs] app/api restored (trap)"
  fi
  if [ -d "$DEV_SURFACE_STASH" ]; then
    for d in "${DEV_SURFACE_DIRS[@]}"; do
      if [ -d "$DEV_SURFACE_STASH/$d" ]; then
        mkdir -p "$(dirname "$d")"
        mv "$DEV_SURFACE_STASH/$d" "$d"
      fi
    done
    rm -rf "$DEV_SURFACE_STASH"
    echo "[ipfs] dev surfaces restored (trap)"
  fi
}
trap restore_all EXIT
# Signal-safe restore — a hard kill (INT/TERM/HUP) must never leave the tree
# mutated with stashed sources. restore_all is idempotent (it guards on stash
# existence) so a double fire on EXIT + signal is safe.
trap 'restore_all; exit 130' INT TERM HUP

# Stale-stash recovery — a SIGKILL/crash mid-build leaves stashes behind;
# a later build opening that simply deleted them, destroying the original
# sources. Recovery is source-preserving in both directions:
#   - stash exists, target missing  -> mv the source back (true recovery)
#   - stash exists, target exists    -> the stash is a husk (the source was
#     restored by the trap); rm only the husk, never a restored source
recover_stale_stashes() {
  if [ -d "$API_STASH" ]; then
    if [ -d "$API_DIR" ]; then
      rm -rf "$API_STASH"
      echo "[ipfs] stale api stash husk removed"
    else
      mv "$API_STASH" "$API_DIR"
      echo "[ipfs] stale api stash recovered"
    fi
  fi
  if [ -d "$DEV_SURFACE_STASH" ]; then
    for d in "${DEV_SURFACE_DIRS[@]}"; do
      if [ -d "$DEV_SURFACE_STASH/$d" ]; then
        if [ -d "$d" ]; then
          rm -rf "$DEV_SURFACE_STASH/$d"
        else
          mkdir -p "$(dirname "$d")"
          mv "$DEV_SURFACE_STASH/$d" "$d"
        fi
      fi
    done
    rm -rf "$DEV_SURFACE_STASH"
    echo "[ipfs] dev-surface stashes recovered"
  fi
  if [ -d "$LINK_IMPORT_STASH" ] && [ -s "$LINK_IMPORT_STASH/.manifest" ]; then
    restore_link_imports
  fi
}

recover_stale_stashes

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

rewrite_link_imports

export ROOTSTOCK_EXPORT=1
# bake the export-mode flag — the app uses it to route RPCs to
# public endpoints (no /api proxy on the ship) and for full-page
# navigation decisions.
export NEXT_PUBLIC_IPFS_EXPORT=1
# the ship is a production build — bake the prod app env explicitly.
# The default (dev) would mislabel the ship and flip prod-gated features.
export NEXT_PUBLIC_APP_ENV=prod
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

restore_link_imports

echo "[ipfs] DONE - static site in out/"
