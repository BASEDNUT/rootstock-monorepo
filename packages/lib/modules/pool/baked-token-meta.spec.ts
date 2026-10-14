import { describe, expect, it } from 'vitest'
import { getBakedPools } from './onchain-pool-fetch'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/**
 * audit fix F6 (2026-09-23): baked registry tokens carry address ONLY.
 * PoolListTokenPills renders icon-only pills (no symbol text) because
 * poolTokens mapped with no symbol/name. Browser-verified defect.
 * Fix: registry tokens become objects {address, symbol?, name?, decimals?}
 * and getBakedPools passes them through.
 *
 * FIX-6: getBakedPools is per-chain — Sepolia registry + the Base
 * mainnet registry (baked-pool-registry-base.json) both keep the law.
 */
describe('getBakedPools(chain) — token metadata enrichment (F6)', () => {
  it('baked pool tokens carry symbol when registry provides it', () => {
    const pools = getBakedPools(GqlChainValues.BaseSepolia)
    expect(pools.length).toBeGreaterThan(0)

    // 2026-09-24: the REAL named pool is 'Rootstock WETH/BAL Pool'
    // (0x1aba...77c7). The old 0xBeC8 entry is mock-named and filtered out.
    const real = pools.find(
      p => p.address.toLowerCase() === '0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7'
    )

    expect(real).toBeDefined()

    const symbols = (real!.poolTokens || []).map(
      // poolTokens carry optional ERC20 metadata (symbol/name/decimals)
      (t: { symbol?: string }) => t.symbol || ''
    )

    expect(symbols.some(s => s.length > 0)).toBe(true)
  })

  it('all baked pool tokens are non-empty objects with addresses (both chains)', () => {
    for (const pools of [
      getBakedPools(GqlChainValues.BaseSepolia),
      getBakedPools(GqlChainValues.Base),
    ]) {
      for (const p of pools) {
        for (const t of p.poolTokens || []) {
          expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
        }
      }
    }
  })

  it('per-chain law: Sepolia items tagged BASESEP, mainnet items tagged BASE', () => {
    for (const p of getBakedPools(GqlChainValues.BaseSepolia)) {
      expect(p.chain).toBe(GqlChainValues.BaseSepolia)
    }

    for (const p of getBakedPools(GqlChainValues.Base)) {
      expect(p.chain).toBe(GqlChainValues.Base)
    }
  })
})
