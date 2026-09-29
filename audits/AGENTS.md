# audits — AGENTS.md

Upstream Balancer audit reports — lineage evidence for the inherited architecture. Read-only reference material.

## Directories

| Path          | Content                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `balv3-core/` | Balancer V3 core audits (Spearbit, Trail of Bits, Certora, Cantina) — the architecture Rootstock forked |
| `reclamm/`    | reCLAMM pool math audits (Certora, Cantina)                                                             |

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
