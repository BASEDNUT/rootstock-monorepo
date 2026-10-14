# ROOTSTOCK

**BASED NUT's programmable liquidity engine for custom markets.**

One core: Root Vault, Root Pools, Root Hooks, Root Routers. Forked from Balancer v3's audited architecture and grown for Based Nut — custom pools, token primitives (mint + wrap), and liquidity bootstrapping, served as a static app over IPFS.

## Quick map

| Want                                          | Go                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Run the app locally                           | [INIT.md](./INIT.md) — setup from zero                                                                           |
| Build the IPFS artifact                       | [INIT.md](./INIT.md) → Build static export                                                                       |
| Contribute code                               | [AGENTS.md](./AGENTS.md) — rules, architecture, law specs                                                        |
| Verify our contracts                          | [deployments/PROVENANCE.md](./deployments/PROVENANCE.md) — byte-exact proof, 45/45 mainnet + 69/69 Sepolia GREEN |
| Self-host the app (your keys, your IPFS node) | [SELF-HOST.md](./SELF-HOST.md) — clone → build → pin → serve                                                     |
| Study the inherited security                  | [audits/](./audits/AGENTS.md) — Balancer's audit reports (lineage)                                               |
| Understand a workspace                        | [apps/frontend-v3/AGENTS.md](./apps/frontend-v3/AGENTS.md) · [packages/lib/AGENTS.md](./packages/lib/AGENTS.md)  |

## For development

```bash
pnpm install
cp apps/frontend-v3/.env.template apps/frontend-v3/.env.local
pnpm dev:bal        # http://localhost:3000
pnpm test:unit      # law specs enforce brand/scope — keep green
```

Full setup including the static export path: [INIT.md](./INIT.md).

## For research

- **Is this really Balancer's audited code?** Every deployed contract is proven byte-identical to Balancer's officially-committed build artifacts. Verify in [deployments/PROVENANCE.md](./deployments/PROVENANCE.md).
- **What was audited, when, by whom?** The inherited architecture carries Balancer's professional audit reports (preserved verbatim); our two primitive factories carry an internal skills-based review (2026-09-27, 0 Critical/High/Medium) — an independent third-party audit of the primitives is planned. The reports (Spearbit, Trail of Bits, Certora, Cantina) are preserved verbatim in [audits/](./audits/AGENTS.md).
- **What did Rootstock add?** Exactly two original contracts: TokenFactory + WrapperFactory. The MevCaptureHook deploys as an upstream task (byte-exact upstream code, registry addition). Plus this frontend and the [patches/](./patches) SDK adaptation. Everything else is upstream.
- **Hosting:** the app is a static export published to IPFS under a content-addressed CID - the app itself has no DNS host (project documentation lives at docs.basednut.com/rootstock).
- For ROOTSTOCK Docs: https://docs.basednut.com/rootstock

## The engine

- **Root Vault** — one contract holds every asset, one ledger for every pool
- **Root Pools** — the market math: weighted, stable, boosted, reCLAMM, custom
- **Root Hooks** — policies that run before and after every market operation
- **Root Routers** — the entry point for swaps and liquidity, users and solvers

## Testnet

69 proven entries on Base Sepolia (84532) — 53 task-deployed contracts, 14 registry test fixtures, 2 factory-derived live contracts — with the real deployments end-to-end verified: initialize → add liquidity → swap → remove liquidity, receipts on record. Registry: [deployments/base-sepolia.json](./deployments/base-sepolia.json).

**Base MAINNET is live (8453, deployed 2026-10-03):** 45 contracts bytecode-verified at the current registry (45/45 byte-exact + 45/45 immutable read-back GREEN — [deployments/PROVENANCE.md](./deployments/PROVENANCE.md)), treasury multisig is Authorizer admin from birth, permission/fee paths rehearsed GREEN on a live-fork. Registry: [deployments/base.json](./deployments/base.json). Vulnerability disclosures: [SECURITY.md](./SECURITY.md) (support@basednut.com).

## Lineage and licenses

- Contracts: forked from GPL-3.0 `balancer-v3-monorepo` (pristine copy, full upstream test suite passing)
- Frontend: forked from MIT `frontend-monorepo` (this tree)
- reCLAMM math: forked from GPL-3.0 `balancer/reclamm`

Balancer's architecture is their work — we keep it, credit it, and grow on it.

Licensing: this frontend fork is MIT (© Balancer + © 2026 BASEDNUT — see [LICENSE](./LICENSE)); [`patches/@balancer__sdk@6.2.0.patch`](./patches/@balancer__sdk@6.2.0.patch) patches the SDK per its own license. The two primitives (MIT) live in [BASEDNUT/sol-contracts](https://github.com/BASEDNUT/sol-contracts); the upstream contracts remain GPL-3.0 lineage — their source is the public `balancer-v3-monorepo`, and every deployed byte is proven against it in [deployments/PROVENANCE.md](./deployments/PROVENANCE.md).

## Based Nut

- ROOTSTOCK Docs: https://docs.basednut.com/rootstock
- The Orchard: https://orchard.basednut.com
- [Twitter](https://x.com/BASEDNUT_)
