# audits — AGENTS.md

Upstream Balancer audit reports — lineage evidence for the inherited architecture. Read-only reference material.

## Directories

| Path          | Content                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `balv3-core/` | Balancer V3 core audits (Spearbit, Trail of Bits, Certora, Cantina) — the architecture Rootstock forked |
| `reclamm/`    | reCLAMM pool math audits (Certora, Cantina)                                                             |

## Rootstock's own coverage

- `2026-09-27-primitive-factories-verify-audit.md` — TokenFactory + WrapperFactory: internal skills-based audit (evm-audit-erc20 checklist + Foundry invariant gate 24/24 incl. solvency invariant 1000 runs), 0 Critical/High/Medium, 3 Low/Info documented trade-offs. The audited source is public: [BASEDNUT/sol-contracts](https://github.com/BASEDNUT/sol-contracts) `src/primitives/`.
- `S113b-AUDIT-COVERAGE-MATRIX.md` — maps every deployed contract to its audit coverage (inherited upstream vs. own).

## Rules

- **Read-only.** These are Balancer's audit reports — do not edit, do not rebrand. They document the inherited architecture, not Rootstock-specific changes.
- **Renamed `v3-core` → `balv3-core` (S107)** — these are Balancer audits, not Rootstock audits. Path is referenced in the root README table.
- **Audits ≠ current-state proof.** They document Balancer's code at audit time. The current-state proof for Rootstock deployments is the byte-exact provenance sweep — see [deployments/PROVENANCE.md](../deployments/PROVENANCE.md).

## For researchers

The chain of trust:

1. Balancer's audited architecture → these reports
2. Rootstock deploys Balancer's committed build artifacts → [deployments/](../deployments/AGENTS.md) proves it byte-for-byte
3. Our own additions (TokenFactory, WrapperFactory) → audited 2026-09-27, 0 Critical/High/Medium

## Repo map

[Root AGENTS.md](../AGENTS.md) · [INIT.md](../INIT.md) · [deployments/](../deployments/AGENTS.md)
