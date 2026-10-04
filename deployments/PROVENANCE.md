# Deployments — Provenance Proof (Base Sepolia 84532 + Base MAINNET 8453)

## Claim

Every contract deployed by Rootstock is **byte-identical to Balancer's own officially-committed build artifacts**, with exactly one exception pair: our **TokenFactory + WrapperFactory** primitives, byte-identical to our audited source (audit: 0 Critical / 0 High / 0 Medium, 2026-09-27).

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

Deployed 2026-10-03 (see [base.json](./base.json)). Every mainnet contract is proven byte-identical to the same upstream/audited build artifacts:

| Class            | Count | Meaning                                                                                         |
| ---------------- | ----: | ----------------------------------------------------------------------------------------------- |
| EXACT_MATCH      |     4 | byte-for-byte sha256 match (incl. TokenFactory + WrapperFactory vs our audited forge artifacts) |
| MATCH_IMMUTABLES |    37 | same, with solc immutableReferences ranges masked (constructor args differ per-chain by design) |
| MATCH_CORPUS     |     4 | bytecode matches Balancer's committed build-info compiler output                                |
| PRIMITIVE (ours) |     2 | TokenFactory + WrapperFactory — byte-exact vs our S105-audited source                           |

Evidence: [provenance-sweep-base-mainnet-20261004.json](./provenance-sweep-base-mainnet-20261004.json) — rerunnable, same script, same method.

**Live permission evidence (supplementary):** [s113-live-multisig-admin-check.json](./s113-live-multisig-admin-check.json) — `hasRole(DEFAULT_ADMIN_ROLE, treasury-multisig)` = **true** on the live mainnet Authorizer (zero-address sanity = false). The treasury multisig holds root admin from birth.

## Count reconciliation (why 55 / 45 / 43 / 47 differ)

- **55** = verification battery rows: all live contracts incl. **13 mock test fixtures** (Mock pools/oracles from upstream factory tasks — disposable, filtered from the canonical registry) + 42 real contracts.
- **45** = canonical registry ([base.json](./base.json)): 42 real upstream-task contracts + MevCaptureHook + TokenFactory + WrapperFactory (S113d additions).
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

## Evidence files

- `base-sepolia.json` — full deployment registry (67 entries, 43 tasks, deployer, receipts)
- `provenance-sweep-20260928.json` — 69-row sweep result: per-contract sha256 pairs, statuses, corpus sources
- `provenance_sweep.py` — rerunnable proof script (stdlib + requests only, selftest included)
