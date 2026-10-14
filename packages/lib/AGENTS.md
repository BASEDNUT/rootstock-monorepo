# packages/lib — AGENTS.md

`@repo/lib` — the shared frontend library. Almost all Rootstock business logic lives here, not in
the app shell ([app AGENTS.md](../../apps/frontend-v3/AGENTS.md)).

## Rules

- **Never hardcode project-specific values.** Single-project repo: config is resolved from
  `NEXT_PUBLIC_PROJECT_ID` in `config/getProjectConfig.ts`. `isBeets` is hardcoded `false` — do not
  reintroduce beets plumbing.
- **Chains: Base mainnet + Base Sepolia only.** `config/projects/balancer.ts` is the single project
  config.
- **Onchain-only networks never reach the remote API** — `toApiNetworks` / `isOnchainOnlyNetwork`
  (config/getProjectConfig.ts) enforce it.
- **Factory tokens need no registry edits** — `modules/primitives` scans
  `TokenCreated`/`WrapperCreated` events and feeds TokensProvider (pickers law, spec-enforced).
- **Pool actions go through handler patterns** in `modules/pool/actions/` — onchain handlers for
  Base Sepolia, API-backed for upstream networks.

## Layout

| Path                  | Content                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `config/`             | Project config, chains, app config, `getProjectConfig`                                |
| `modules/pool/`       | Pool domain: types, actions, list, detail                                             |
| `modules/primitives/` | TokenFactory + WrapperFactory wiring: addresses, ABIs, factory-token scan, pages data |
| `modules/tokens/`     | TokensProvider + token data                                                           |
| `modules/web3/`       | Wallet connectors, safe hooks, WalletConnect metadata                                 |
| `modules/swap/`       | Swap handlers + logic                                                                 |
| `modules/portfolio/`  | Positions, claim, table                                                               |
| `shared/`             | Components, services (Apollo), utils                                                  |

## Law specs (keep green)

- `config/projects/nav-laws.spec.ts` — nav journey order
- `config/projects/projects.spec.ts` — project config structure, Base+Sepolia only
- `modules/primitives/primitive-pages.spec.ts` — primitive pages laws

A red law spec is a scope violation, not a flaky test.

## Repo map

[Root AGENTS.md](../../AGENTS.md) · [INIT.md](../../INIT.md) ·
[deployments/](../../deployments/PROVENANCE.md)
