# deployments — AGENTS.md

Deployment registry + byte-exact provenance proofs for ROOTSTOCK contracts — Base MAINNET (8453, live 2026-10-03) + Base Sepolia (84532).

## Files

| File                                  | Content                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `PROVENANCE.md`                       | The proof doc — claim, result table, method, how to verify               |
| `base-sepolia.json`                   | Full deployment registry (67 entries, 43 tasks, deployer, receipts)      |
| `base.json`                           | Base MAINNET registry (45 contracts, 39 tasks, deployer, multisig admin) |
| `s113-live-deploy-verification.json`  | 55/55 live-verified battery (Base mainnet, 2026-10-03)                   |
| `s113-rehearsal-predictions.json`     | Pre-deploy address predictions (fork rehearsal — 53/55 exact match)      |
| `s113b-permission-fee-rehearsal.json` | Permission/fee-path rehearsal (10/10 gates GREEN, fork of live Base)     |
| `s113-live-deploy-create-audit.json`  | CREATE-tx audit (tx classification, gas accounting)                      |
| `provenance-sweep-20260928.json`      | 69-row sweep result: per-contract sha256 pairs, statuses, corpus sources |
| `provenance_sweep.py`                 | Rerunnable proof script (selftest included)                              |

## Rules

- **The claim:** every deployed contract is byte-identical to Balancer's officially-committed build artifacts, except our two primitives (TokenFactory + WrapperFactory), byte-identical to our audited source.
- **Never edit evidence JSON by hand** — rerun the sweep: `python3 provenance_sweep.py --selftest` then full run against the live chain.
- **Registry updates follow deploys** — new deployment = new registry entry + rerun sweep + updated PROVENANCE.md result table.
- **No fabricated hosts** anywhere in these files.

## Upstream sources

- Task artifacts + build-info: [balancer/balancer-deployments](https://github.com/balancer/balancer-deployments) (committed compiler output — the provenance anchor)
- Our primitive factories: local audited source (audit 2026-09-27, 0 Critical/High/Medium)

## Repo map

[Root AGENTS.md](../AGENTS.md) · [INIT.md](../INIT.md) · [audits/](../audits/AGENTS.md)
