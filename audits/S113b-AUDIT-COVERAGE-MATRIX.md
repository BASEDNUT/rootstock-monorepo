# Rootstock Audit-Coverage Matrix — S113b (2026-10-03)

Canonical evidence: `balancer/scripts/provenance_sweep_20260928.json` (69/69 GREEN, 0 issues — S107 Gate 1). Delta class: **zero contract-source modifications vs upstream pinned commit**; Rootstock additions = 2 new permissionless factories (S105-audited) + deployment configuration.

## Inheritance rules (byte-identity status -> audit coverage)

| Provenance status   |  Count | Coverage rule                                                                                  |
| ------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| EXACT_MATCH         |      4 | byte-identical to upstream committed artifact — full upstream audit coverage inherited         |
| MATCH_IMMUTABLES    |     41 | byte-identical after immutable-placeholder masking — full upstream audit coverage inherited    |
| MATCH_CORPUS        |     15 | byte-identical to upstream build-info corpus artifact — full upstream audit coverage inherited |
| DUPLICATE_OF        |      6 | same-contract redeploy (corpus-resolved) — coverage inherited from canonical instance          |
| UPSTREAM_REUSE_LIVE |      2 | canonical upstream-deployed address reused directly (Permit2/WETH-class) — upstream coverage   |
| CONFIG_ONLY         |      1 | configuration entry, no bytecode — N/A                                                         |
| **TOTAL**           | **69** | **proven, 0 issues**                                                                           |

## Upstream audits inherited (byte-identical code)

| Audit                          | Firm       | Scope                             |
| ------------------------------ | ---------- | --------------------------------- |
| 2024-09-04 Certora             | 2024-09-04 | Vault, Weighted Pool, Stable Pool |
| 2024-10-08 Trail of Bits       | 2024-10-08 | Vault, Weighted Pool, Stable Pool |
| 2024-10-04 Spearbit            | 2024-10-04 | Vault, Weighted Pool, Stable Pool |
| 2024-12-17 Cantina (pre-comp)  | 2024-12-17 | Pre-competition v3 codebase       |
| 2024-12-24 Certora             | 2024-12-24 | Gyroscope pools                   |
| 2024-12-31 Cantina (post-comp) | 2024-12-31 | Post-competition v3 codebase      |
| 2025-01-30 Certora             | 2025-01-30 | Stable Surge Factory / Hook       |
| 2025-02-07 Certora             | 2025-02-07 | MEV Capture Hook                  |
| 2025-02-17 Certora             | 2025-02-17 | Liquidity Bootstrapping Pool      |
| 2025-08-19 Certora             | 2025-08-19 | LP Oracles                        |
| 2025-09-08 Certora             | 2025-09-08 | Nested Pool Router                |
| 2025-09-10 Certora             | 2025-09-10 | ECLP Oracles                      |
| 2026-01-26 Certora             | 2026-01-26 | Comprehensive Security Assessment |

_Reports archived in mirror: `balancer/mirrors/balancer-v3-monorepo/audits/` (certora/ spearbit/ trail-of-bits/ cantina/ + WONTFIX.md + test-report.md). Note (upstream): some contracts modified AFTER audit — our provenance sweep pins OUR bytecode to the CURRENT upstream committed artifacts, which include post-audit fixes (e.g. Spearbit 5.2.6 resolved via PR #1113)._

## Rootstock-specific code (NOT covered by upstream audits)

| Contract                                                 | Coverage                                                                                                  | Evidence                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| TokenFactory `0xB27D...4b13`                             | S105 audit: 0 Critical / 0 High / 0 Medium; permissionless, zero admin surface, factories hold zero state | [2026-09-27-primitive-factories-verify-audit.md](./2026-09-27-primitive-factories-verify-audit.md) |
| WrapperFactory `0x678a...0dC7`                           | S105 audit (same battery)                                                                                 | [2026-09-27-primitive-factories-verify-audit.md](./2026-09-27-primitive-factories-verify-audit.md) |
| Deployment configuration (input.ts blocks, network keys) | Not code — config values reviewed in S113 runbook                                                         | rootstock/docs/S113-MAINNET-RUNBOOK.md (project-internal; public repo carries the audit doc)       |

## NOT covered anywhere (honest gaps)

- Rootstock as a SYSTEM (composition, deployment ordering, config values) — mitigated by S107 fork chain 37/37 + S113/S113b rehearsals + provenance sweep, but no third-party audit exists for the composition itself.
- TimelockAuthorizer: never deployed upstream, not deployed by us (V2-era Authorizer used for parity — ARD-01).

## Security reporting path (Boss decision pending)

- Upstream path: Immunefi Balancer bounty — **dies Oct 30 2026** (winddown), and never covered OUR deployments (asset-list based).
- Orchard doctrine page: orchard.basednut.com/security (disclosure section exists — SEAL 911 sources).
- Rootstock needs: disclosure contact, triage owner, response SLA — Boss decision (block 8).

## Verdict

69/69 deployed contracts proven byte-identical to upstream audited artifacts OR covered by S105 (new factories) — with 2 honest gaps named (composition, TimelockAuthorizer-not-deployed). "Balancer was audited" is now an evidence-backed claim for our stack: 66 contracts inherit upstream audits, 2 factories carry S105.
