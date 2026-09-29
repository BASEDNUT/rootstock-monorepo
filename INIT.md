# INIT.md — Setup from zero

Everything needed to go from a fresh clone to a running dev server and a built static export.

## Prerequisites

- Node 24.x, pnpm ≥ 8 (`corepack enable` or `npm i -g pnpm`)
- A wallet RPC if you want live chain reads (optional for unit tests)

## Install

```bash
git clone https://github.com/BASEDNUT/rootstock-monorepo.git
cd rootstock-monorepo
pnpm install
```

The `@balancer/sdk@6.2.0` patch (`patches/`) is applied automatically by pnpm during install.

## Environment

```bash
cp apps/frontend-v3/.env.template apps/frontend-v3/.env.local
```

Core values:

- `NEXT_PUBLIC_PROJECT_ID` — set to `balancer` (legacy upstream id; the project is ROOTSTOCK)
- `NEXT_PUBLIC_WALLET_CONNECT_ID` — WalletConnect project id (appsig.dev)
- `NEXT_PUBLIC_BALANCER_API_URL` — market data GraphQL endpoint
- `NEXT_PUBLIC_SITE_URL` — optional; gates sitemap entries. **Do not invent a value — hosting is IPFS, no DNS host exists.**

## Develop

```bash
pnpm dev:bal        # http://localhost:3000
```

## Test

```bash
pnpm test:unit      # vitest across workspaces
```

Law specs (brand/scope enforcement) are listed in [AGENTS.md](./AGENTS.md) → Testing.

## Build static export (IPFS artifact)

```bash
ROOTSTOCK_EXPORT=1 pnpm build
node apps/frontend-v3/scripts/serve-static.mjs   # serve out/ locally, default :8091
```

`build-ipfs.sh` stashes dev-only surfaces (`app/api`, `app/(app)/debug`) for the export and restores them after. The exported artifact has no DNS host — it is published to IPFS under a content-addressed CID.

## Contracts + deployments

Deployed contract addresses and byte-exact provenance proofs: [`deployments/`](./deployments/PROVENANCE.md).

## Repo map

See [AGENTS.md](./AGENTS.md) → Architecture for the full table of workspaces and owning docs.
