# ROOTSTOCK

**BASED NUT's programmable liquidity engine for custom markets.**

One core: Root Vault, Root Pools, Root Hooks, Root Routers. Forked from Balancer v3's audited architecture and grown for Based Nut — custom pools, token primitives (mint + wrap), and liquidity bootstrapping, served as a static app over IPFS.

## Quick map

| Want                         | Go                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Run the app locally          | [INIT.md](./INIT.md) — setup from zero                                                                           |
| Build the IPFS artifact      | [INIT.md](./INIT.md) → Build static export                                                                       |
| Contribute code              | [AGENTS.md](./AGENTS.md) — rules, architecture, law specs                                                        |
| Verify our contracts         | [deployments/PROVENANCE.md](./deployments/PROVENANCE.md) — byte-exact proof, 45/45 mainnet + 69/69 Sepolia GREEN |
| Study the inherited security | [audits/](./audits/AGENTS.md) — Balancer's audit reports (lineage)                                               |
| Understand a workspace       | [apps/frontend-v3/AGENTS.md](./apps/frontend-v3/AGENTS.md) · [packages/lib/AGENTS.md](./packages/lib/AGENTS.md)  |

## For development

```bash
pnpm install
cp apps/frontend-v3/.env.template apps/frontend-v3/.env.local
pnpm dev:bal        # http://localhost:3000
pnpm test:unit      # law specs enforce brand/scope — keep green
```

Full setup including the static export path: [INIT.md](./INIT.md).

## For research

- **Is this really Balancer's audited code?** Yes — every deployed contract is proven byte-identical to Balancer's officially-committed build artifacts. The proof is machine-checkable and rerunnable: [deployments/PROVENANCE.md](./deployments/PROVENANCE.md).
- **What was audited, when, by whom?** The inherited architecture's audit reports (Spearbit, Trail of Bits, Certora, Cantina) are preserved verbatim in [audits/](./audits/AGENTS.md).
- **What did Rootstock add?** Exactly two contracts: TokenFactory + WrapperFactory (permissionless primitives, audited 2026-09-27, 0 Critical/High/Medium), plus this frontend and the [patches/](./patches) SDK adaptation. Everything else is upstream.
- **Hosting:** static export published to IPFS under a content-addressed CID. No DNS host exists.

## The engine

- **Root Vault** — one contract holds every asset, one ledger for every pool
- **Root Pools** — the market math: weighted, stable, boosted, reCLAMM, custom
- **Root Hooks** — policies that run before and after every market operation
- **Root Routers** — the entry point for swaps and liquidity, users and solvers

## Testnet

65 contracts live on Base Sepolia (84532), end-to-end verified: initialize → add liquidity → swap → remove liquidity, receipts on record. Registry: [deployments/base-sepolia.json](./deployments/base-sepolia.json).

**Base MAINNET is live (8453, deployed 2026-10-03):** 55 contracts live-verified, treasury multisig is Authorizer admin from birth, permission/fee paths rehearsed GREEN on a live-fork. Registry: [deployments/base.json](./deployments/base.json). Vulnerability disclosures: [SECURITY.md](./SECURITY.md) (support@basednut.com).

## Lineage and licenses

- Contracts: forked from GPL-3.0 `balancer-v3-monorepo` (pristine copy, full upstream test suite passing)
- Frontend: forked from MIT `frontend-monorepo` (this tree)
- reCLAMM math: forked from GPL-3.0 `balancer/reclamm`

Balancer's architecture is their work — we keep it, credit it, and grow on it.

## Based Nut

- The Orchard: https://orchard.basednut.com
- [Twitter](https://x.com/BASEDNUT_)
