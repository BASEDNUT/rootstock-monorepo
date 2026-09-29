# Deployments — Provenance Proof (Base Sepolia 84532)

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
