# deployments — AGENTS.md

Deployment registry + byte-exact provenance proofs for ROOTSTOCK contracts (Base Sepolia 84532).

## Files

| File                             | Content                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| `PROVENANCE.md`                  | The proof doc — claim, result table, method, how to verify               |
| `base-sepolia.json`              | Full deployment registry (67 entries, 43 tasks, deployer, receipts)      |
| `provenance-sweep-20260928.json` | 69-row sweep result: per-contract sha256 pairs, statuses, corpus sources |
| `provenance_sweep.py`            | Rerunnable proof script (selftest included)                              |

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
