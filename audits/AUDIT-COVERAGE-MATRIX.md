# Rootstock Audit-Coverage Matrix (2026-10-03)

Canonical evidence: `deployments/provenance-sweep-20260928.json` (69/69 GREEN, 0 issues — Gate 1, 2026-09-28). Delta class: **zero contract-source modifications vs upstream pinned commit**; Rootstock additions = 2 new permissionless factories (internal skills-based review 2026-09-27) + deployment configuration.

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

| Audit                          | Firm                                                                | Scope                             |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------- |
| 2024-09-04 Certora             | 2024-09-04                                                          | Vault, Weighted Pool, Stable Pool |
| 2024-12-11 Trail of Bits       | report archived at `audits/balv3-core/trail-of-bits/2024-12-11.pdf` | Vault, Weighted Pool, Stable Pool |
| 2024-10-04 Spearbit            | 2024-10-04                                                          | Vault, Weighted Pool, Stable Pool |
| 2024-12-17 Cantina (pre-comp)  | 2024-12-17                                                          | Pre-competition v3 codebase       |
| 2024-12-24 Certora             | 2024-12-24                                                          | Gyroscope pools                   |
| 2024-12-31 Cantina (post-comp) | 2024-12-31                                                          | Post-competition v3 codebase      |
| 2025-01-30 Certora             | 2025-01-30                                                          | Stable Surge Factory / Hook       |
| 2025-02-07 Certora             | 2025-02-07                                                          | MEV Capture Hook                  |
| 2025-02-17 Certora             | 2025-02-17                                                          | Liquidity Bootstrapping Pool      |
| 2025-08-19 Certora             | 2025-08-19                                                          | LP Oracles                        |
| 2025-09-08 Certora             | 2025-09-08                                                          | Nested Pool Router                |
| 2025-09-10 Certora             | 2025-09-10                                                          | ECLP Oracles                      |
| 2026-01-26 Certora             | 2026-01-26                                                          | Comprehensive Security Assessment |

_Reports are archived in this repository under `audits/balv3-core/` (cantina/ certora/ spearbit/ trail-of-bits/ + WONTFIX.md + test-report.md) and `audits/reclamm/`. Note (upstream): some contracts modified AFTER audit — our provenance sweep pins OUR bytecode to the CURRENT upstream committed artifacts, which include post-audit fixes (e.g. Spearbit 5.2.6 resolved via PR #1113)._

## Rootstock-specific code (NOT covered by upstream audits)

| Contract                                                 | Coverage                                                                                                                  | Evidence                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| TokenFactory `0xB27D...4b13`                             | Internal review 2026-09-27: 0 Critical / 0 High / 0 Medium; permissionless, zero admin surface, factories hold zero state | [2026-09-27-primitive-factories-verify-audit.md](./2026-09-27-primitive-factories-verify-audit.md) |
| WrapperFactory `0x678a...0dC7`                           | Internal review 2026-09-27 (same battery)                                                                                 | [2026-09-27-primitive-factories-verify-audit.md](./2026-09-27-primitive-factories-verify-audit.md) |
| Deployment configuration (input.ts blocks, network keys) | Not code — config values reviewed in the deployment runbook                                                               | deployment runbook (project-internal; this public repo carries the audit doc)                      |

## NOT covered anywhere (honest gaps)

- Rootstock as a SYSTEM (composition, deployment ordering, config values) — mitigated by live-fork rehearsal chain 37/37 + deployment rehearsals + provenance sweep, but no third-party audit exists for the composition itself.
- TimelockAuthorizer: never deployed upstream, not deployed by us (V2-era Authorizer used for parity — ARD-01).

## Security reporting path

- Report vulnerabilities to **support@basednut.com** — see [SECURITY.md](../SECURITY.md) (same contact served at `/.well-known/security.txt`).
- No Rootstock bug-bounty program exists at this time; the upstream Balancer Immunefi bounty ends 2026-10-30 under the protocol winddown and never covered Rootstock deployments.

## Verdict

69/69 deployed contracts proven byte-identical to upstream audited artifacts OR covered by the 2026-09-27 internal review (new factories) — with 2 honest gaps named (composition, TimelockAuthorizer-not-deployed). "Balancer was audited" is now an evidence-backed claim for our stack: 66 contracts inherit upstream audits, 2 factories carry the internal review.
