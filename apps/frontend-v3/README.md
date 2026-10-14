# ROOTSTOCK frontend

The Rootstock web app — BASED NUT's programmable liquidity engine for custom markets.

- Trade: swap any pooled asset
- Build: create custom pools, mint tokens, wrap tokens, launch LBPs
- Track: portfolio, positions, activity — all onchain, no account needed

Stack: Next.js (App Router, static export), viem + wagmi + RainbowKit, Apollo for market data.

## Hosting

This app is built as a **static site and published to IPFS**. There is no DNS host — content lives
at IPFS gateways under a content-addressed CID. See `scripts/build-ipfs.sh`.

## Getting started

```bash
pnpm install
pnpm dev:bal          # dev server on localhost:3000
```

## Environment

Copy `.env.template` to `.env.local`. Core keys: `NEXT_PUBLIC_WALLET_CONNECT_ID` and
`NEXT_PUBLIC_PROJECT_ID`.

## Static export

```bash
ROOTSTOCK_EXPORT=1 pnpm build
node scripts/serve-static.mjs   # serve out/ locally (default :8091)
```

## Testing

```bash
pnpm test:unit
```

## Contracts

Deployed contracts and byte-exact provenance proofs live in
[`deployments/`](../../deployments/PROVENANCE.md) at the repo root.
