# apps/frontend-v3 — AGENTS.md

The ROOTSTOCK web app. Thin Next.js App Router shell — business logic lives in `packages/lib`
([its AGENTS.md](../../packages/lib/AGENTS.md)).

## Rules

- **Static export + IPFS hosting.** No DNS host exists. `NEXT_PUBLIC_SITE_URL` gates sitemap
  entries; never hardcode a host (export-laws spec bans it).
- **Onchain-only networks** (Base Sepolia) are never sent to the remote API as query variables
  (`toApiNetworks` in packages/lib).
- **Forms always visible, wallet gates only the action button** (the /lbp pattern). Never hide GUI
  behind wallet connection.
- **Pickers law:** every token minted/wrapped by the factories auto-appears in all token pickers via
  the factory-event scan — zero registry edits.
- App-level `.env.local` is required to boot the dev server (see [INIT.md](../../INIT.md)).

## Routes

| Route                           | Content                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/swap`                         | Swap any pooled asset                                                                            |
| `/pools`                        | Pool list (live onchain scan)                                                                    |
| `/pools/[chain]/[variant]/[id]` | Pool detail + add/remove liquidity                                                               |
| `/portfolio`                    | Positions                                                                                        |
| `/create`                       | Create custom pool                                                                               |
| `/lbp/create`                   | Liquidity bootstrapping pool wizard                                                              |
| `/mint`                         | Mint token (TokenFactory primitive)                                                              |
| `/wrap`                         | Wrap token (WrapperFactory primitive)                                                            |
| `/nutusd`                       | Ecosystem doorway page — links to the nutUSD vault on Morpho (separate product, not this engine) |
| `(app)/debug/*`                 | Dev-only demo surfaces — stashed out of every export by `scripts/build-ipfs.sh`                  |
| `(marketing)`                   | Landing page                                                                                     |

## Nav (v2, spec-enforced)

Portfolio · Pools · Swap · Create pool · Mint token · Wrap token · Launchpad — progressive
disclosure order; nav-laws spec enforces it.

## Build + serve

- Dev: `pnpm dev:bal` → :3000
- Export: `ROOTSTOCK_EXPORT=1 pnpm build` → `out/`
- Serve export locally: `node scripts/serve-static.mjs` → :8091 (styled 404 fallback)
- `scripts/build-ipfs.sh` stashes dev surfaces (api routes, debug pages) for the export and restores
  them after

## Law specs (keep green)

- `app/(marketing)/_lib/landing-v3/homepage-laws.spec.ts`
- `app/(marketing)/_lib/landing-v3/export-laws.spec.ts`

A red law spec is a scope violation, not a flaky test.

## Repo map

[Root AGENTS.md](../../AGENTS.md) · [INIT.md](../../INIT.md) ·
[deployments/](../../deployments/PROVENANCE.md)
