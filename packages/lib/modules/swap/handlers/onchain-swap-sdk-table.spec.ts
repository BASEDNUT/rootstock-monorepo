import { describe, expect, it } from 'vitest'
import { balancerV3Contracts } from '@balancer/sdk'

// S113-fix C-5 law: every SDK table value for OUR chains (8453 + 84532)
// must equal OUR deployed contracts (LIVE_DEPLOYMENTS.md) after the runtime
// patch (importing the handler module applies the patch). The SDK ships
// upstream Balancer addresses for 8453; routing through them would target
// pools that are not ours — the misroute class.

// Import AFTER the table snapshot so the patch application is observable.
import './OnchainSwap.handler'

const EXPECTED_8453: Record<string, string> = {
  Router: '0xc8dcC030C81635Da8df2D7fb35573E661B01cDCe',
  BatchRouter: '0x1428F95C891669f49299634076292215b2B78A31',
  CompositeLiquidityRouter: '0xA14865dC542e075F6c3e3c8D49be68a1b2D1a758',
  Vault: '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
  WeightedPoolFactory: '0x9a5bd368C8dA0d7fad33Fc89b6be4e39E5A33F92',
  StablePoolFactory: '0x74c9804b4659fEb7d056F150a810C4B5ae926DA1',
  StableSurgePoolFactory: '0x179BdCaeBADF57d6Be08DB5776781F4D0B64d5ce',
  GyroECLPPoolFactory: '0xF7024Eb7D37e993c8959090C84762F6273e43682',
  ReClammPoolFactory: '0x730bF6Af759e9E74aa6f9F0950e233dF974D1859',
  LBPoolFactory: '0xf5CAC7d8e637D2827C07c44Ae4767093647b0867',
  FixedPriceLBPoolFactory: '0x5dBd872F506aB714bF4D9C20675598D9F1495bA8',
  MevCaptureHook: '0xfE807044D0329BD96aEa42A78F091c2Db1069f42',
  StableSurgeHook: '0x2Bdde9A6e0f9ad3f7349E09617cF7fEB655c5981',
  BufferRouter: '0xEa94Cee1C04E50e43935c4078F69B68df3Dc3946',
  UnbalancedAddViaSwapRouter: '0x9e586F22ab23A0040231E78a4d021B5f761036E5',
  VaultAdmin: '0xFbE459C6D811d474464F0209296590BBe35814Ca',
  VaultExtension: '0x2234Add4f8284e98cA51830678D6A66553506a07',
}

const EXPECTED_84532: Record<string, string> = {
  Router: '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759',
  BatchRouter: '0x41978EB90477d4D971dF22111B2d09679f4DadA6',
  CompositeLiquidityRouter: '0x5808B214B66C70e6c0759803AbF3498c2c78F437',
  Vault: '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9',
  BufferRouter: '0xe1c7A291D4eBa814f36Ec96fD10F343A53BFa1D7',
  UnbalancedAddViaSwapRouter: '0xbbEc9F2c69037852A86aB3F97326172649E82337',
  VaultAdmin: '0xC67111C130b1380E5ba027733315DE82bB5A6837',
  VaultExtension: '0x8e86fDf21a578cDB01F1A58c71a2ef21dBBE2A8E',
}

// Real upstream Balancer 8453 values (extracted from the installed dist).
const UPSTREAM_8453 = new Set([
  '0x85a80afee867aDf27B50BdB7b76DA70f1E853062', // upstream Router + BatchRouter (Base)
  '0x4132f7AcC9dB7A6cF7BE2Dd3A9DC8b30C7E6E6c8', // upstream BufferRouter (Base)
  '0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c', // upstream CompositeLiquidityRouter (Base)
  '0x7fA49Df302a98223d98D115fc4FCD275576f6faA', // upstream UnbalancedAddViaSwapRouter (Base)
  '0x35fFB749B273bEb20F40f35EdeB805012C539864', // upstream VaultAdmin (Base)
  '0x0E8B07657D719B86e06bF0806D6729e3D528C9A9', // upstream VaultExtension (Base)
  '0xbA1333333333a1BA1108E8412f11850A5C319bA9', // upstream Vault (Base)
  '0xBDbADc891BB95DEE80eBC491699228EF0f7D6fF1', // upstream WeightedPoolFactory (Base)
  '0xFc2986feAB34713E659da84F3B1FA32c1da95832', // upstream StablePoolFactory (Base)
  '0x6623d1CEEaB236ae93aCAfB285dDFB77336B6981', // upstream StableSurgePoolFactory (Base)
  '0x86a0E97eC0D5dB8DAE106D3067358d41968fD12c', // upstream GyroECLPPoolFactory (Base)
  '0x3ccD78683efFffdDc1A16f5553C896ac6D3ab7FF', // upstream ReClammPoolFactory (Base)
  '0xb96524227c4B5Ab908FC3d42005FE3B07abA40E9', // upstream LBPoolFactory + FixedPriceLBPoolFactory (Base)
  '0x7A2535f5fB47b8e44c02Ef5D9990588313fe8F05', // upstream MevCaptureHook (Base)
  '0xDB8d758BCb971e482B2C45f7F8a7740283A1bd3A', // upstream StableSurgeHook (Base)
])

describe('SDK address table — ROOTSTOCK chains law (C-5)', () => {
  it('8453: every patched key equals our deployment registry', () => {
    for (const [key, expected] of Object.entries(EXPECTED_8453)) {
      const actual = (balancerV3Contracts as any)[key][8453]
      expect(actual, `8453 ${key}`).toBe(expected)
    }
  })

  it('8453: every patched key is NOT the upstream Balancer address', () => {
    for (const key of Object.keys(EXPECTED_8453)) {
      const actual = (balancerV3Contracts as any)[key][8453]
      expect(UPSTREAM_8453.has(actual), `8453 ${key} still upstream: ${actual}`).toBe(false)
    }
  })

  it('84532: every key present equals our Sepolia deployment registry', () => {
    for (const [key, expected] of Object.entries(EXPECTED_84532)) {
      const actual = (balancerV3Contracts as any)[key][84532]
      expect(actual, `84532 ${key}`).toBe(expected)
    }
  })

  it('8453/84532: no key of our registry resolved to the zero address', () => {
    const ZERO = '0x0000000000000000000000000000000000000000'

    for (const key of Object.keys(EXPECTED_8453)) {
      expect((balancerV3Contracts as any)[key][8453]).not.toBe(ZERO)
    }

    for (const key of Object.keys(EXPECTED_84532)) {
      expect((balancerV3Contracts as any)[key][84532]).not.toBe(ZERO)
    }
  })

  it('handler module loads without throwing (Gyro2 guard holds)', () => {
    // SDK 6.2.0 table has no Gyro2CLPPoolFactory key; the guarded assignment
    // must not crash module load (latent-crash regression test).
    expect(true).toBe(true)
  })
})
