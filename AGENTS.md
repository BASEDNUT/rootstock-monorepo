# AGENTS.md

Guidance for coding agents working in the ROOTSTOCK monorepo.

## Rules

### Next.js: ALWAYS read docs before coding

Before any Next.js work, read the relevant doc in `apps/frontend-v3/node_modules/next/dist/docs/`. Training data is outdated — the docs are the source of truth.

### Project identity

This repo is **ROOTSTOCK** — BASED NUT's programmable liquidity engine for custom markets. The active project config is `packages/lib/config/projects/balancer.ts` (project id `balancer` is legacy naming from the upstream fork), resolved via `NEXT_PUBLIC_PROJECT_ID` in `packages/lib/config/getProjectConfig.ts`.

- Use `PROJECT_CONFIG.projectName`, `projectUrl`, `projectLogo` — never hardcoded brand strings.
- Chains: Base mainnet + Base Sepolia (dev mode) only.
- Single-project repo: `isBeets` is a hardcoded `false`; the beets app/config are pruned and must not be reintroduced.

### Frontend scope (IPFS interaction surface)

The frontend is the web3 interaction surface: swap, create pool, LBP, mint token, wrap token. No DNS host exists — the app is a static export published to IPFS. `NEXT_PUBLIC_SITE_URL` gates sitemap entries; no fabricated hosts, ever (spec-enforced ban).

## Architecture

pnpm workspaces + Turborepo. `apps/frontend-v3` is a thin Next.js App Router shell — almost all business logic lives in `packages/lib` (`@repo/lib`). Prefer adding new code to `packages/lib` unless genuinely app-specific.

| Path                                                   | Content                                              | Owning doc                                                   |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------ |
| `apps/frontend-v3`                                     | The web app (static export → IPFS)                   | [`apps/frontend-v3/AGENTS.md`](./apps/frontend-v3/AGENTS.md) |
| `packages/lib`                                         | Shared frontend library (theme, modules, config)     | [`packages/lib/AGENTS.md`](./packages/lib/AGENTS.md)         |
| `packages/e2e-tests`                                   | Playwright e2e suites                                | —                                                            |
| `packages/eslint-config`, `packages/typescript-config` | Tooling configs                                      | —                                                            |
| `deployments`                                          | Deployment registry + byte-exact provenance proofs   | [`deployments/AGENTS.md`](./deployments/AGENTS.md)           |
| `audits`                                               | Upstream Balancer audit reports (lineage, read-only) | [`audits/AGENTS.md`](./audits/AGENTS.md)                     |
| `patches`                                              | pnpm patched-dependencies (`@balancer/sdk@6.2.0`)    | —                                                            |

## Key patterns

- **Blockchain interaction**: viem + wagmi + RainbowKit. Pool actions go through handler patterns in `packages/lib/modules/pool/actions/`.
- **Data fetching**: Apollo Client for GraphQL market data, react-query for other async. GraphQL codegen runs before `next build` — don't run `graphql:gen` manually outside a build cycle.
- **Multi-chain**: config in `packages/lib/modules/chains/`.
- **URL state**: `nuqs`.
- **Pool types**: Weighted, Stable, CowAmm, LBP, AutoRange, ECLP — each with specific UI and action handlers.

## Testing

Run unit tests: `pnpm test:unit` (vitest). Law specs enforce brand/scope:

- `apps/frontend-v3/app/(marketing)/_lib/landing-v3/homepage-laws.spec.ts` — homepage brand/scope laws
- `apps/frontend-v3/app/(marketing)/_lib/landing-v3/export-laws.spec.ts` — export integrity laws (fabricated-URL bans)
- `packages/lib/config/projects/nav-laws.spec.ts` — nav journey laws
- `packages/lib/modules/primitives/primitive-pages.spec.ts` — primitive pages laws

Keep them green. A red law spec means a scope violation, not a flaky test.

## Setup from zero

See [`INIT.md`](./INIT.md).

## PR guidelines

- **Title + Summary** — context and what changed.
- **Risks / Breaking Changes** — call out anything that could regress: changed token decimals or balances handling, migration requirements, changes behind a feature flag (name the flag), dependency bumps, or anything touching shared `packages/lib` code.
