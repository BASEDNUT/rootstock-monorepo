# RATE_PROVIDERS.md - Base rate provider register

*Generated, do not hand-edit. Regenerate with:*

```
git clone https://github.com/balancer/code-review
export RP_CODE_REVIEW_DIR=/path/to/code-review
export RP_OUT_DIR=.            # where to write
export RP_RPC=https://base.publicnode.com
python scripts/gen_rate_providers.py
```

A rate provider tells a Balancer pool that a token is worth more (or less) than 1:1
because it accrues value. Without one, the pool prices the token as flat forever.

## Provenance

| Field | Value |
|---|---|
| Source repo | https://github.com/balancer/code-review |
| Commit | `95cba8e973872be52805ba434d65be64967c1304` |
| Commit date | 2026-09-04 08:44:57 -0400 |
| Commit subject | Merge pull request #805 from balancer/review/issue-802 |
| Registry file mtime (UTC) | 2026-09-17T04:18:07.221650+00:00 |
| Review documents in repo | 230 |
| Chains in registry | 16 |
| Base providers | 33 |
| Base distinct assets | 30 |
| On-chain read at block | 53076908 |
| Generated (UTC) | 2026-10-25T15:46:29.289735+00:00 |

Local mirror: `balancer/mirrors/code-review/rate-providers/`

## What ROOTSTOCK uses right now

| Rate provider | Rate | Used by |
|---|---|---|
| `0x3786a6CAAB433f5dfE56503207DF31DF87C5b5C1` | 1.142352 | rks-WETH-CBETH-SURGE (0x2Ae3F1Ec...), pNUT (0x2Ae3F1Ec...) |

## Base inventory (all reviewed providers)

| Asset | Rate | Provider | Review name | Verdict | Upgradeable |
|---|---|---|---|---|---|
| BRZ `0xE9185Ee2...` | 5.106100 | `0xD8BC11AA3F7aA53193dC098aDb0d8776fa1e194B` | BRZTokenRateProvider.md | safe | no |
| cbBTC `0xcbb7c000...` | 29.000000 | `0xd58338f102e8de2e3d9d54cc043c6d606826a790` | ConstantRateProvider | safe | no |
| cbBTC `0xcbb7c000...` | 35.500000 | `0x4a0f0012004bc22d4fdb818b9c539e78adc0c69d` | ConstantRateProvider | safe | no |
| cbETH `0x2Ae3F1Ec...` | 1.142352 | `0x3786a6CAAB433f5dfE56503207DF31DF87C5b5C1` | cbETH Rate Provider | safe | no |
| EURC `0x60a3e35c...` | 1.119921 | `0x1298d51c51a201614502f90f554549256f1121fe` | EURc Rate Provider | safe | no |
| ezETH `0x2416092f...` | 1.088602 | `0x6ac3b3BeCE5AA61C6AB5d50ecd2D47b1f18ACe49` | ezETH Rate Provider | safe | no |
| fWETH `0x9272D615...` | 1.029714 | `0x0bB7028D24b24424485E769bD44b936B315Cb8FC` | fluid weth rate provider | safe | no |
| hBTC `0x9C2dCDbD...` | 1.000558 | `0x586d1D28D5F8aeD81dA8AEf7016c4108f7A4ce51` | EmberHilbertBTCRateProvider.md | safe | yes |
| IDRX `0x18Bc5bcC...` | 0.000059 | `0xfd9F651ca1e136f47d50C102D33D6cd342673C65` | IDRXRateProvider.md | safe | no |
| rETH `0xB6fe221F...` | 1.174431 | `0x039f7205C2cBa4535C2575123Ac3D657263892c4` | rETH RocketPool Rate Provider | safe | no |
| stataBasUSDC `0x4EA71A20...` | 1.150783 | `0x4467Ab7BC794bb3929d77e826328BD378bf5392F` | ERC4626RateProvider | safe | yes |
| sUSDS `0x5875eEE1...` | 1.113594 | `0x84394fa6a39bdff63b255622da362b113c690267` | SavingsUSDSRateProvider | safe | yes |
| tETH `0xd09ACb80...` | 1.256637 | `0x8d3E5E54A703ebC5e70C635268e7886d629486E4` | TreehouseETHRateProvider.md | safe | no |
| waBascbBTC `0xFA2A03b6...` | 1.002043 | `0xbF21251c74208771e25De5C08971cE586236EE89` | ERC4626RateProvider | safe | no |
| waBascbETH `0x5e8B6741...` | 1.146823 | `0x940748d30315276362f594ECcCb648A4f9aB7629` | AaveMarketRateTransformer | safe | no |
| waBasEURC `0x729F75Af...` | 1.160238 | `0xdBB41Da7dE45729857A09baaF98D1e9b0b1A8740` | aEURC to USD AaveMarketRateTransform | safe | no |
| waBasezETH `0xF8F10f39...` | 1.088617 | `0xFF4B2CE4131E0Fb6b8A40447B4dF96Bdc83f759a` | AaveMarketRateTransformer | safe | no |
| waBasGHO `0x88b1Cd4b...` | 1.071010 | `0xf8CDA16566a06f3C848258DE4Ec5fc3401cbB214` | Aave GHO StataV2 | safe | no |
| waBasUSDbC `0x74D4D1D4...` | 1.140246 | `0xBa0Fd0f3B019e8aBA61FEA2ac4Eb56b29F6808c0` | ERC4626RateProvider | safe | no |
| waBasUSDC `0xC768c589...` | 1.150783 | `0x0368b79b6A173a5aD589594E3227153D8cC7Cecc` | ERC4626RateProvider | safe | no |
| waBasWETH `0xe298b938...` | 1.052167 | `0x14BD1e9b30007510c2aFE3a7a8053A6DE5605d35` | ERC4626RateProvider | safe | no |
| waBaswstETH `0x0830820D...` | 1.250984 | `0xcb1f29103F710A0A562de7f0e9DDE223D0860674` | AaveMarketRateTransformer | safe | no |
| weETH `0x04C0599A...` | 1.106495 | `0x5a7A419C59eAAdec8Dc00bc93ac95612e6e154Cf` | weETH Rate Provider | safe | no |
| WETH `0x42000000...` | 1900.000000 | `0x5E10C2a55fB6E4C14c50C7f6B82bb28A813a4748` | ConstantRateProvider | safe | no |
| WETH `0x42000000...` | 2600.000000 | `0x3e89cc86307aF44A77EB29d0c4163d515D348313` | ConstantRateProvider | safe | no |
| WETH `0x42000000...` | 3300.000000 | `0x3fA516CEB5d068b60FDC0c68a3B793Fc43B88f15` | ConstantRateProvider | safe | no |
| wexBaseUSDC `0x589A7339...` | 1.040907 | `0x2e40AcBBB710e04BeE940560Af0B0932018b67Ec` | WrappedExtraFiX Base USDCRateProvide | safe | yes |
| wstETH `0xc1cba3fc...` | 1.247173 | `0x3b3dd5f913443bb5E70389F29c83F7DCA460CAe1` | wstETH Rate Provider | safe | no |
| yoBTC `0xbCbc8cb4...` | 1.015520 | `0x47fc979C519fA6c07D4dB6ab7B7573e20d94C5F9` | YoVaultBTCRateProvider.md | safe | yes |
| yoETH `0x3A43AEC5...` | 1.093689 | `0xB0027C1C870573d5626Df1f049a12E39d3e613e9` | YoVaultETHRateProvider.md | safe | yes |
| yoUSD `0x0000000f...` | 1.068500 | `0x8Cb017261719799f8b5A3762Ebe2b0e214F9a735` | YoVaultUSDRateProvider.md | safe | yes |
| yUSD `0x895e1502...` | 0.998454 | `0xD47c15CDD7c734db321F07CB9AB1f852aE9A0b83` | YieldFi yUSD Rate Provider | safe | yes |
| yUSD `0x4772D2e0...` | 0.998454 | `0x2fb9fb5eB65c17B405c1B1c02bAE992D625B34c6` | YieldFiyUSDRateProvider.md | safe | yes |

## Our pools and what each token registers

| Pool | Type | Token | TokenType | Rate provider |
|---|---|---|---|---|
| rks-NUT-WETH | WEIGHTED | `0x4200000000000000000000000000000000000006` | STANDARD | - |
|  |  | `0xb8DE15Fb529d98C93C749De63c749D48D25A30DF` | STANDARD | - |
| rks-TBTC-CBBTC | STABLE | `0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b` | STANDARD | - |
|  |  | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | STANDARD | - |
| rks-WETH-CBETH-SURGE | STABLE | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | WITH_RATE | `0x3786a6CAAB433f5dfE56503207DF31DF87C5b5C1` |
|  |  | `0x4200000000000000000000000000000000000006` | STANDARD | - |
| pNUT | WEIGHTED | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | WITH_RATE | `0x3786a6CAAB433f5dfE56503207DF31DF87C5b5C1` |
|  |  | `0xAC130701aa31c284c36609E2489f150F419AD7AD` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |
|  |  | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | STANDARD | - |
| gtINF | WEIGHTED | `0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |
|  |  | `0xF4d97F2da56e8c3098f3a8D538DB630A2606a024` | STANDARD | - |
| gtAGT | WEIGHTED | `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b` | STANDARD | - |
|  |  | `0x7431aDa8a591C955a994a21710752EF9b882b8e3` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |
| gtETH | WEIGHTED | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |
|  |  | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` | STANDARD | - |
| gtBTC | WEIGHTED | `0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |
|  |  | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | STANDARD | - |
| gtFX | WEIGHTED | `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42` | STANDARD | - |
|  |  | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |
| nutSALT-rCLP | RECLAMM | `0x1EDe2AFC985F6D7aEb3F4c84B95A103c00D5dE81` | STANDARD | - |
|  |  | `0xb8DE15Fb529d98C93C749De63c749D48D25A30DF` | STANDARD | - |
| pipsUSDC-rCLP | RECLAMM | `0x3F2327221Dd4f0BAE660172606D6b288A1cf8aD9` | STANDARD | - |
|  |  | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | STANDARD | - |
| gtSIL | WEIGHTED | `0xb20000000000000000000078ee7ce2fE4908108C` | STANDARD | - |
|  |  | `0xb200000000000000000000C2e324d24d7eEcd1fb` | STANDARD | - |
|  |  | `0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3` | STANDARD | - |

## Wishlist coverage

Tokens on the ROOTSTOCK expansion roadmap. `Direct provider` means a reviewed
provider exists on the token itself. `Wrapped-form provider` means one exists only
on a wrapped or savings form, which is not the same asset and needs care.

| Token | Direct provider | Wrapped-form provider | Detail |
|---|---|---|---|
| aero | no | no | - |
| gho | no | yes | only on wrapped form: Aave GHO StataV2 `0xf8CDA16566a06f3C848258DE4Ec5fc3401cbB214` |
| dai | no | no | - |
| usds | no | yes | only on wrapped form: SavingsUSDSRateProvider `0x84394fa6a39bdff63b255622da362b113c690267` |
| reth | yes | no | rETH RocketPool Rate Pro `0x039f7205C2cBa4535C2575123Ac3D657263892c4` |
| weeth | yes | no | weETH Rate Provider `0x5a7A419C59eAAdec8Dc00bc93ac95612e6e154Cf` |
| morpho | no | no | - |
| well | no | no | - |
| aave | no | no | - |
| susds | yes | no | SavingsUSDSRateProvider `0x84394fa6a39bdff63b255622da362b113c690267` |
| usd+ | no | no | - |
| lbtc | no | no | - |
| syrupusdc | no | no | - |
| wrseth | no | no | - |
| degen | no | no | - |
| clanker | no | no | - |
| bnkr | no | no | - |
| keycat | no | no | - |
| chad | no | no | - |
| doginme | no | no | - |
| miggles | no | no | - |
| ski | no | no | - |
| wabasusdc | yes | no | ERC4626RateProvider `0x0368b79b6A173a5aD589594E3227153D8cC7Cecc` |
| wabasweth | yes | no | ERC4626RateProvider `0x14BD1e9b30007510c2aFE3a7a8053A6DE5605d35` |
| wabasgho | yes | no | Aave GHO StataV2 `0xf8CDA16566a06f3C848258DE4Ec5fc3401cbB214` |
| wabaseurc | yes | no | aEURC to USD AaveMarketR `0xdBB41Da7dE45729857A09baaF98D1e9b0b1A8740` |
| mai | no | no | - |
| yfi | no | no | - |
| wsteth | yes | yes | direct: wstETH Rate Provider `0x3b3dd5f913443bb5E70389F29c83F7DCA460CAe1` | wrapped: AaveMarketRateTransforme `0xcb1f29103F710A0A562de7f0e9DDE223D0860674` |
| usdt | no | no | - |
| usdc | no | yes | only on wrapped form: ERC4626RateProvider `0x0368b79b6A173a5aD589594E3227153D8cC7Cecc`, ERC4626RateProvider `0x4467Ab7BC794bb3929d77e826328BD378bf5392F` |
| jeur | no | no | - |
| frxusd | no | no | - |
| superoethb | no | no | - |
| ovn | no | no | - |
| red | no | no | - |
| link | no | no | - |
| hunt | no | no | - |
| mint | no | no | - |
| wusdr | no | no | - |
| usdbc | no | yes | only on wrapped form: ERC4626RateProvider `0xBa0Fd0f3B019e8aBA61FEA2ac4Eb56b29F6808c0` |
| usdz | no | no | - |
| alusdb | no | no | - |
| aixbt | no | no | - |

## Boundaries

- Registry verdicts are Balancer's review words, not our audit.
- A provider existing does not mean the asset is safe or liquid on Base.
- Wiring a provider is a VaultAdmin call = multisig. No agent execution.
- Rates are a block-pinned snapshot, not a live price feed for trading.
