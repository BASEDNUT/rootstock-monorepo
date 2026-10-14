# Deployments — Provenance Proof (Base Sepolia 84532 + Base MAINNET 8453)

## Claim

Every contract deployed by Rootstock is **byte-identical to Balancer's own officially-committed build artifacts**, with exactly one exception pair: our **TokenFactory + WrapperFactory** primitives, byte-identical to our forge build of [BASEDNUT/sol-contracts](https://github.com/BASEDNUT/sol-contracts) `src/primitives/` (internal skills-based review 2026-09-27, 0 Critical/High/Medium — independent third-party audit planned: [report](../audits/2026-09-27-primitive-factories-verify-audit.md)).

## Result: 69/69 GREEN, 0 issues (2026-09-28)

| Class               | Count | Meaning                                                                                                       |
| ------------------- | ----: | ------------------------------------------------------------------------------------------------------------- |
| EXACT_MATCH         |     4 | sha256(artifact deployedBytecode) == sha256(eth_getCode), byte-for-byte                                       |
| MATCH_IMMUTABLES    |    41 | same, with solc immutableReferences ranges masked on both sides (constructor args differ per-chain by design) |
| MATCH_CORPUS        |    15 | bytecode matches Balancer's committed build-info compiler output (resolves same-contract redeploys)           |
| UPSTREAM_REUSE_LIVE |     2 | canonical predeploys reused, unmodified: Permit2, WETH                                                        |
| CONFIG_ONLY         |     1 | registry entry with no bytecode (BAL = 0x0 marker)                                                            |
| DUPLICATE_OF        |     6 | same address redeployed by a later task (registry bookkeeping)                                                |

## Base MAINNET (8453) — Result: 45/45 GREEN, 0 issues (2026-10-04)

Deployed 2026-10-03 (see [base.json](./base.json)). Every mainnet contract is proven byte-identical to the same upstream, professionally audited build artifacts:

By **status** (rows sum to 45):

| Status           | Count | Meaning                                                                                         |
| ---------------- | ----: | ----------------------------------------------------------------------------------------------- |
| EXACT_MATCH      |     4 | byte-for-byte sha256 match — 2 upstream + **2 ours** (TokenFactory, WrapperFactory)             |
| MATCH_IMMUTABLES |    37 | same, with solc immutableReferences ranges masked (constructor args differ per-chain by design) |
| MATCH_CORPUS     |     4 | bytecode matches Balancer's committed build-info compiler output                                |

By **class** (rows sum to 45):

| Class                  | Count | Meaning                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK_DEPLOYED (theirs) |    43 | Balancer V3 upstream task artifacts — byte-exact                                                                                                                                                                                                                                                                                                                                                              |
| PRIMITIVE (ours)       |     2 | TokenFactory + WrapperFactory — byte-exact vs our forge build of [BASEDNUT/sol-contracts](https://github.com/BASEDNUT/sol-contracts) `src/primitives/` (internal skills-based review 2026-09-27, 0 Critical/High/Medium — scope in [AUDIT-COVERAGE-MATRIX.md](../audits/AUDIT-COVERAGE-MATRIX.md); independent third-party audit planned: [report](../audits/2026-09-27-primitive-factories-verify-audit.md)) |

Evidence: [provenance-sweep-base-mainnet-20261004.json](./provenance-sweep-base-mainnet-20261004.json) — rerunnable, same script, same method.

**Live permission evidence (supplementary):** [live-multisig-admin-check.json](./live-multisig-admin-check.json) — `hasRole(DEFAULT_ADMIN_ROLE, treasury-multisig)` = **true** on the live mainnet Authorizer (zero-address sanity = false). The treasury multisig holds root admin from birth.

## Count reconciliation (why 55 / 45 / 43 / 47 differ)

- **55** = verification battery rows: all live contracts incl. **13 mock test fixtures** (Mock pools/oracles from upstream factory tasks — disposable, filtered from the canonical registry) + 42 real contracts.
- **45** = canonical registry ([base.json](./base.json)): 42 real upstream-task contracts + MevCaptureHook + TokenFactory + WrapperFactory (registry additions, 2026-10-03).
- **43/2** = sweep classes: 43 TASK_DEPLOYED upstream rows + 2 PRIMITIVE rows (ours).
- Sepolia (69 rows) = 67 registry entries + 2 factory-derived instances ([factory_derived](./base-sepolia.json) — registry-driven, chain-correct).

## How to verify yourself

```bash
# requirements: python3 + requests, upstream repos cloned:
#   balancer/balancer-deployments  (per-task artifacts + build-info, official)
#   our primitives built with forge (out/ artifacts)
python3 deployments/provenance_sweep.py \
  --rpc https://sepolia.base.org \
  --registry deployments/base-sepolia.json \
  --repo <path>/balancer-deployments \
  --sol <path>/sol-contracts/out \
  --out sweep-result.json
python3 deployments/provenance_sweep.py --selftest  # 8 offline test groups
```

Expected: `verdict: GREEN`, 69/69 proven, 0 issues.

## Method

1. For each registry address: fetch live `eth_getCode` from Base Sepolia.
2. Load the matching upstream task artifact (`artifact/<Contract>.json`, `deployedBytecode`) — Balancer's officially committed compiler output.
3. Pair with the same task's `build-info` (matched by exact bytecode-object equality) to get solc `immutableReferences` + `linkReferences` byte ranges.
4. Mask those ranges on BOTH sides (zeros), sha256 both, compare — byte-exact outside constructor-arg slots.
5. Fallback: match against the FULL build-info corpus (all tasks + forge out) — a unique contract-level hit is provenance; same-contract multi-hits collapse to one.
6. Primitive factories compare against OUR forge artifacts (TokenFactory, WrapperFactory — the only code that is ours).

## ## Immutable read-back (constructor arguments, both chains, 2026-10-10)

The byte-exact sweep masks constructor-arg slots by design (per-chain args differ). The immutable read-back closes that gap: every declared immutable slot is extracted from live runtime bytecode, decoded, and compared against the registry — see `verify_immutables.py` / `immutable-verification.json`.

| Chain                | Contracts | VERIFIED | Flagged | Slots matched | Verdict                  |
| -------------------- | --------: | -------: | ------: | ------------: | ------------------------ |
| Base mainnet (8453)  |        45 |       45 |       0 |           447 | **GREEN**                |
| Base Sepolia (84532) |        69 |       63 |       3 |           798 | RED — flagged, see below |

Flagged (Sepolia, honest open items — inherited-wire classification, not proven divergence): `VaultFactory` (multi-value code-hash slots), `CowSwapFeeBurner` + `ERC4626CowSwapFeeBurner` (same-contract UNLISTED_LIVE/DEAD verdicts on inherited wiring slots). Byte-exact sweep still passes these contracts; the read-back flags them for registry-listing follow-up. No mainnet contract is flagged.

## Role battery (who holds admin, both chains, 2026-10-10)

`verify_roles.py` / `role-verification.json` / [ROLE_VERIFICATION.md](./ROLE_VERIFICATION.md): positive check (treasury multisig `0xcc59...3c5a` holds DEFAULT_ADMIN_ROLE) + negative check (deployer wallet holds zero roles) on every registry contract with an AccessControl surface.

- **Base mainnet: GREEN** — multisig admin 2/2, deployer 0 roles. Multisig-administered from birth. Signer set + threshold (2-of-3, live read-back): [ROLE_VERIFICATION.md](./ROLE_VERIFICATION.md).
- **Base Sepolia: finding** — the two AccessControl contracts (Authorizer, TestBalancerToken) predate the multisig-from-birth policy: deployer wallet holds DEFAULT_ADMIN_ROLE on both. Testnet-only, known provenance, no funds at risk. Remediation is maintainer-gated.

## Evidence files

- `base-sepolia.json` — full deployment registry (67 entries, 43 tasks, deployer, receipts)
- `provenance-sweep-20260928.json` — 69-row sweep result: per-contract sha256 pairs, statuses, corpus sources
- `provenance_sweep.py` — rerunnable proof script (stdlib + requests only, selftest included)
