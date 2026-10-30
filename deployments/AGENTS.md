# deployments — AGENTS.md

Deployment registry + byte-exact provenance proofs for ROOTSTOCK contracts — Base MAINNET (8453, live 2026-10-03) + Base Sepolia (84532).

## Files

| File                                          | Content                                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROVENANCE.md`                               | The proof doc — claim, result table, method, how to verify                                                                                                                                                     |
| `base-sepolia.json`                           | Full deployment registry (67 entries, 43 tasks, deployer, receipts) + `superseded` map (4 never-use addresses, S113-fix)                                                                                       |
| `base.json`                                   | Base MAINNET registry (45 contracts, 39 tasks, deployer, multisig admin) + `superseded` map (7 never-use addresses, S113-fix)                                                                                  |
| `live-deploy-verification.json`               | 55/55 live-verified battery (Base mainnet, 2026-10-03)                                                                                                                                                         |
| `live-rehearsal-predictions.json`             | Pre-deploy address predictions (fork rehearsal — 53/55 exact match)                                                                                                                                            |
| `live-permission-fee-rehearsal.json`          | Permission/fee-path rehearsal (10/10 gates GREEN, fork of live Base)                                                                                                                                           |
| `live-deploy-create-audit.json`               | CREATE-tx audit - inconclusive: 0 creates recorded, 40 deployer-nonce gaps unaccounted; not evidence of absence (bytecode provenance is the authoritative record)                                              |
| `provenance-sweep-20260928.json`              | 69-row sweep result: per-contract sha256 pairs, statuses, corpus sources                                                                                                                                       |
| `provenance-sweep-base-mainnet-20261028.json` | Post-S113-fix-sync sweep: 45/45 GREEN (registry at new addresses, 2026-10-28)                                                                                                                                  |
| `provenance-sweep-base-sepolia-20261028.json` | Post-S113-fix-sync sweep: 69/69 GREEN (registry at new addresses, 2026-10-28)                                                                                                                                  |
| `provenance_sweep.py`                         | Rerunnable proof script (selftest included)                                                                                                                                                                    |
| `verify_immutables.py`                        | On-chain immutable read-back vs registry (selftest included)                                                                                                                                                   |
| `verify_roles.py`                             | Positive+negative role battery (read-only eth_call)                                                                                                                                                            |
| `immutable-verification.json`                 | Immutable read-back results: mainnet 45/45 GREEN, 447 slots matched                                                                                                                                            |
| `role-verification.json`                      | Role battery results: mainnet GREEN (multisig 2/2, deployer 0 roles)                                                                                                                                           |
| `pools-mainnet.json`                          | Unified public pool registry — ALL BASED NUT ecosystem pools on Base mainnet: 65 pools (30 legacy venue + 6 Sunflower Grove grafts + 5 kernel engine pools + 24 ROOTSTOCK V3), every address on-chain verified |
| `verify_pools.py`                             | Rerunnable on-chain verification for pools-mainnet.json (selftest + live battery; exit 0 = all GREEN)                                                                                                          |
| `ROLE_VERIFICATION.md`                        | Role battery summary table (both chains, one honest Sepolia finding)                                                                                                                                           |

## Rules

- **The claim:** every deployed contract is byte-identical to Balancer's officially-committed build artifacts, except our two primitives (TokenFactory + WrapperFactory), byte-identical to our audited source.
- **Never edit evidence JSON by hand** — rerun the sweep: `python3 provenance_sweep.py --selftest` then full run against the live chain.
- **Registry updates follow deploys** — new deployment = new registry entry + rerun sweep + updated PROVENANCE.md result table.
- **No fabricated hosts** anywhere in these files.
- **Superseded contracts are never resolvable** — `superseded` map entries (`never_use: true`) are provenance records of defective deployments; never reintroduce them into `tasks`, and consumers must treat them as dead.

## Upstream sources

- Task artifacts + build-info: [balancer/balancer-deployments](https://github.com/balancer/balancer-deployments) (committed compiler output — the provenance anchor)
- Our primitive factories: local audited source (audit 2026-09-27, 0 Critical/High/Medium)

## Repo map

[Root AGENTS.md](../AGENTS.md) · [INIT.md](../INIT.md) · [audits/](../audits/AGENTS.md)
