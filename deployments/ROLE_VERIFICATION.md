# ROLE VERIFICATION

Multisig `0xcc59bE4Fd171b9868B092CBa017207B87bA23c5a` vs deployer wallet DEFAULT_ADMIN_ROLE battery (read-only eth_call).

## Base mainnet (8453) - GREEN

| Contract          | Address                                    | Multisig admin | Deployer admin |
| ----------------- | ------------------------------------------ | -------------- | -------------- |
| Authorizer        | 0x4BC9Ee12AB3700cF514A34855e0691BFAc387C6A | True           | False          |
| TestBalancerToken | 0x6C8a67866Fb1f2ac2aaa45bBB5c38c07C3Fe4de3 | True           | False          |

All 43 other scanned contracts: no AccessControl surface (hasRole reverts - pools, routers, hooks, factories).

## Treasury multisig — on-chain signer set (read 2026-10-11)

Safe `0xcc59bE4Fd171b9868B092CBa017207B87bA23c5a`, L2 1.4.1, **threshold 2 of 3 owners** (live `getThreshold()` / `getOwners()` eth_call, https://base.publicnode.com):

| #   | Owner                                        | Role                                                                                                                                                                             |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `0x135b208aC2480B0d876944416DE16E7A3b9a1F65` | workbench wallet (operations, holds zero admin roles — negative-checked live 2026-10-11: `hasRole(DEFAULT_ADMIN_ROLE, 0x135b…)` = false on both mainnet AccessControl contracts) |
| 2   | `0x145C584f2f022997A9d0e5FCb4346042229525E1` | operator wallet (holds zero admin roles — negative-checked live 2026-10-11, same battery)                                                                                        |
| 3   | `0x9e1B8070eE6d3e396fCBC84403813d1aD447A9Ef` | cold-storage wallet (off-chain signing only)                                                                                                                                     |

All three Safe owners hold zero admin roles on every mainnet AccessControl contract — only the multisig itself carries admin. Verified by read-only `eth_call hasRole(DEFAULT_ADMIN_ROLE, <signer>)` against the Authorizer and TestBalancerToken (every other registry contract has no AccessControl surface — `hasRole` reverts).

Any privileged grant (fee changes, permission grants, hook registration) requires 2-of-3 signatures through this Safe. No timelock is deployed in front of it (known honest gap, see [audits/AUDIT-COVERAGE-MATRIX.md](../audits/AUDIT-COVERAGE-MATRIX.md)).

## Base Sepolia (84532) - RED (finding, reported)

| Contract          | Address                                    | Multisig admin | Deployer admin |
| ----------------- | ------------------------------------------ | -------------- | -------------- |
| Authorizer        | 0x1F4ac219924F04d3300638BA67Fbe400836E1017 | False          | True           |
| TestBalancerToken | 0x8c6487b86A73554431d514371184916B0B61B876 | False          | True           |

Finding: the Sepolia deployment predates the multisig-from-birth mainnet policy - the deployer wallet holds DEFAULT_ADMIN_ROLE on both Sepolia AccessControl contracts (Authorizer, TestBalancerToken). Base mainnet is multisig-administered from birth (registry provenance note, live-verified hasRole). No transfer was performed by this read-only battery.

Method: `python3 verify_roles.py --registry <registry> --rpc <url>`; selftest pins the hasRole selector 0x91d14854 (independently confirmed present in deployed build-info bytecode) and the OpenZeppelin canonical zero DEFAULT_ADMIN_ROLE.
