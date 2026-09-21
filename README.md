# ROOTSTOCK monorepo

**BASED NUT's Rootstock** — a programmable liquidity engine for custom markets.
One core: Root Vault, Root Pools, Root Hooks, Root Routers. Forked from Balancer v3's audited architecture and grown for Based Nut.

## What's here

| Path | Content |
|---|---|
| `apps/frontend-v3` | The ROOTSTOCK frontend (Base Sepolia testnet) — swap, create pool, LBP, nutUSD vault |
| `packages/lib` | Shared frontend library (Chakra theme, modules, config) |
| `audits/reclamm` | reCLAMM pool math audit reports (Cantina, Certora) |
| `audits/v3-core` | Upstream Balancer v3 core audit reports (Spearbit, Trail of Bits, Certora, Cantina) |

## The engine

- **Root Vault** — one contract holds every asset and keeps one ledger for every pool
- **Root Pools** — the market math: weighted, stable, boosted, reCLAMM, custom
- **Root Hooks** — policies that run before and after every market operation
- **Root Routers** — the entry point for swaps and liquidity, users and solvers

## Testnet

65 contracts deployed on Base Sepolia, end-to-end verified (initialize, add, swap, remove).

## nutUSD

USDC lending vault on Morpho Blue, live on Base mainnet: `0x846E88618A15766940277471509511bf69443CC1`

- App (deposit/withdraw): https://app.morpho.org/base/vault/0x846E88618A15766940277471509511bf69443CC1/based-nut-usd
- Curator (admin): https://curator.morpho.org/vaults/8453/0x846E88618A15766940277471509511bf69443CC1

## Lineage and licenses

This project is a fork of Balancer's open-source architecture:

- Contracts: forked from the GPL-3.0 licensed `balancer-v3-monorepo` (pristine copy, full upstream test suite passing)
- Frontend: forked from the MIT licensed `frontend-monorepo` (this tree)
- reCLAMM pool math: forked from the GPL-3.0 licensed `balancer/reclamm`

Balancer's architecture is their work — we keep it, credit it, and grow on it. Full audit reports for the inherited architecture live in `audits/`.

## Based Nut

- The Orchard: https://orchard.basednut.com
- Terminal (data layer): https://terminal.basednut.com
- X: https://x.com/BASEDNUT_
