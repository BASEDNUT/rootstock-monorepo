# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Rules

### Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `apps/frontend-v3/node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

### Project identity

This repo is **ROOTSTOCK** — BASED NUT's AMM ("a programmable liquidity engine for custom markets"). The active project config is `packages/lib/config/projects/balancer.ts` (project id `balancer` is legacy naming from the upstream fork), resolved via `NEXT_PUBLIC_PROJECT_ID` in `config/getProjectConfig.ts`, which exposes `PROJECT_CONFIG`.

- Use `PROJECT_CONFIG.projectName`, `projectUrl`, `projectLogo` instead of hardcoded brand strings.
- Chains: Base mainnet + Base Sepolia (dev mode) only.

### Frontend scope (IPFS interaction surface)

The frontend is the web3 interaction surface: swap, create pool, LBP, nutUSD vault. Pools listing and portfolio live at the Orchard Terminal data layer (https://terminal.basednut.com), not here.

## Architecture

pnpm workspaces + Turborepo. `apps/frontend-v3` is a thin Next.js App Router shell — almost all business logic lives in `packages/lib` (`@repo/lib`). Prefer adding new code to `packages/lib` unless it is genuinely app-specific.

- `apps/frontend-v3/app/(app)` — app routes (swap, create, lbp, nutusd, debug)
- `apps/frontend-v3/app/(marketing)` — landing page
- `packages/lib/config/projects/balancer.ts` — project config: networks, links, options
- `packages/lib/modules/*` — feature modules (pool, swap, tokens, web3, ...)
- `packages/lib/shared/*` — shared components and pages

## Testing

Run unit tests: `pnpm test:unit` (vitest). The homepage laws spec is at `apps/frontend-v3/app/(marketing)/_lib/landing-v3/homepage-laws.spec.ts` — it enforces brand/scope laws (zero Balancer on homepage surfaces, no /pools links, chains = Base+Sepolia, etc.). Keep it green.

## PR guidelines

- **Title + Summary** — Context and what changed.
- **Risks / Breaking Changes** — Call out anything that could regress: changed token decimals or balances handling, migration requirements, changes behind a feature flag (name the flag), dependency bumps, or anything touching shared `packages/lib` code.
