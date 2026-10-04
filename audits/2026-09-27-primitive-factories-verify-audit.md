# Primitive Factories — Deployment Verification + Security Audit (2026-09-27)

**Scope:** TokenFactory + WrapperFactory, Base Sepolia, block 47381481 (per Boss table).
**Source tree:** /a0/usr/workdir/sol-contracts (src/primitives/, test/primitives/, script/DeployPrimitives.s.sol)
**Skills:** evm-audit-master → evm-audit-erc20 checklist + general/precision walk

## 1. Deployment verification — ALL CLAIMS TRUE

| Claim                                          | Method                                        | Result                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TokenFactory `0xB27D...4b13` live              | eth_getCode sepolia.base.org                  | ✅ 3,334 bytes code live                                                                                                                               |
| TokenFactory tx `0x9b6e...f614b` status 0x1    | eth_getTransactionReceipt                     | ✅ status 0x1, gas 772,698 EXACT, block 47381481 EXACT, created addr matches EXACT                                                                     |
| WrapperFactory `0x678a...0dC7` live            | eth_getCode                                   | ✅ 4,575 bytes code live                                                                                                                               |
| WrapperFactory tx `0x738f...be661f` status 0x1 | receipt                                       | ✅ status 0x1, gas 1,039,157 EXACT, block 47381481 EXACT, created addr matches EXACT                                                                   |
| Blockscout Pass - Verified (both)              | base-sepolia.blockscout.com API v2            | ✅ is_verified=true both; names TokenFactory/WrapperFactory; compiler v0.8.36+commit.8a079791                                                          |
| Deployer                                       | receipt.from                                  | ✅ hot wallet 0x6bFB...6a9e (matches ledger)                                                                                                           |
| solc 0.8.36, OZ v5.7.0, optimizer 200, via-IR  | foundry.toml + git describe                   | ✅ all exact; OZ v5.7.0 tag-verified                                                                                                                   |
| Verified source = repo tree                    | forge inspect deployedBytecode vs eth_getCode | ✅ sha EXACT MATCH both (TF 5a798df89f1519c1 / WF 3694f090e8384d85) — verified source IS this tree                                                     |
| Foundry gate                                   | forge build + forge test                      | ✅ 24/24 green incl. invariant_WrapperSolvent 1000 runs / 500,000 calls / 0 violations, fee-on-transfer quarantine, self-wrap revert, decimals inherit |

## 2. Security audit findings

**Critical: 0. High: 0. Medium: 0.** No fund-loss vector found. Contract set is minimal, permissionless, no admin surface, no share math, no price math, no approvals held, factory holds nothing.

### Low/Info (design trade-offs, all pre-documented in ARD-06)

| #   | Severity | Finding                                                                                                                                                           | Evidence                                            |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| L-1 | Low      | Rebasing/deflationary underlyings can drive wrapper insolvent → withdrawTo reverts atomically (no theft, DoS only). Documented out-of-scope + UI advisory planned | ARD-06 line 74; invariant test targets non-rebasing |
| L-2 | Low      | `_recover` unexposed (internal OZ, not public) → underlying sent directly to wrapper address is stuck forever. Permissionless no-admin trade-off, documented      | ARD-06 line 33 'DEFAULT: unexposed'                 |
| L-3 | Info     | Fee-on-transfer underlyings quarantine: wrapper stays solvent but deposits are lossy (measured-received mint). By design, tested                                  | test_Wrap_FeeOnTransferQuarantined PASS             |
| I-1 | Info     | No duplicate name/symbol registry — anyone can deploy same-name token. Standard for permissionless factories                                                      | PRD-07 permissionless mandate                       |

### Checklist walk (why no higher findings)

- Fee-on-transfer: MEASURED mint (balance delta) — not parameter amount ✅
- ERC777/hooks: both state-changing fns nonReentrant ✅
- CEI: withdrawTo burns before transfer ✅
- Inflation attack: N/A — 1:1 wrapper, no share-price conversion ✅
- Self-wrap: structurally impossible via factory + OZ guard, tested ✅
- Decimals: auto-inherit via OZ ERC20Wrapper, tested ✅
- USDT-style no-return + approve race: SafeERC20 throughout ✅
- Access control: nothing to protect — no owner, no privileged fns, factories hold zero state beyond CREATE ✅
- Zero-supply/empty name/symbol: guarded with named errors, tested ✅

## 3. Verdict

Deployment table: **VERIFIED TRUE in full (every cell)**. Bytecode on-chain = verified source = repo tree. Audit: **clean** — 0 exploitable findings; 2 Low documented trade-offs + 2 Info. Gate for next step (two pages + E2E walk) remains Boss-gated per S104.

## Addendum 2026-09-28 — external audits absorbed, deltas FIXED

Two external audits reviewed. Auditor 1 (sharp): converged with this audit; one NEW catch absorbed — EIP-7702 delegated EOAs pass `code.length > 0` check (bounded: constructor `decimals()` call reverts atomically, zero fund risk). Auditor 2 (template): discarded — zero grounding, findings contradict source (no privileged fns exist, tx.origin absent, events ARE emitted, custom errors used).

**Deltas landed in ARD-06 Risks (docs-only; deployed .sol NatSpec untouched to preserve byte-exact verified bytecode):**

- EIP-7702 advisory line (delegated-EOA underlying reverts safely at construction)
- Accidental-send honesty note (assets sent directly to factories are unrecoverable by design; name/symbol never trust signals)
