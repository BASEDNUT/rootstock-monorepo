import { describe, expect, it } from 'vitest'
import { mergeOnchainPoolMetrics } from './onchain-detail-metrics'

/**
 * D1 (live-caught 2026-10-27): pool DETAIL pages rendered a hardcoded
 * dynamicData stub (volume24h: '0', fees24h: '0') — tsPHILO detail showed
 * "Swap vol (24h) $0.00" while the same pool's list row showed the true
 * $2.02. Detail must never contradict the list: onchain-only pools get
 * their dynamicData merged from the same onchain metrics source the list
 * uses (useOnchainPoolMetrics), with honest nulls preserved.
 */

describe('mergeOnchainPoolMetrics — detail-page enrichment (D1)', () => {
  it('merges volume/fees from the metrics source over the stub', () => {
    const pool = {
      address: '0x93ef211b7b088fd89df019af387b19b01c9c7bc2',
      dynamicData: { volume24h: '0', fees24h: '0' },
    }

    const enriched = {
      address: '0x93ef211b7b088fd89df019af387b19b01c9c7bc2',
      dynamicData: { volume24h: '2.02', fees24h: '0.001012' },
    }

    const merged = mergeOnchainPoolMetrics(pool as never, [enriched as never])
    expect(merged.dynamicData!.volume24h).toBe('2.02')
    expect(merged.dynamicData!.fees24h).toBe('0.001012')
  })

  it('honest nulls REPLACE the stub zeros (unavailable ≠ zero)', () => {
    const pool = {
      address: '0x' + 'a'.repeat(40),
      dynamicData: { volume24h: '0', fees24h: '0' },
    }

    const enriched = {
      address: '0x' + 'a'.repeat(40),
      dynamicData: { volume24h: null, fees24h: null },
    }

    const merged = mergeOnchainPoolMetrics(pool as never, [enriched as never])
    expect(merged.dynamicData!.volume24h).toBeNull()
    expect(merged.dynamicData!.fees24h).toBeNull()
  })

  it('no metrics entry for the pool → stub zeros become nulls (never fake $0.00)', () => {
    const pool = {
      address: '0x' + 'a'.repeat(40),
      dynamicData: { volume24h: '0', fees24h: '0' },
    }

    const merged = mergeOnchainPoolMetrics(pool as never, [])
    expect(merged.dynamicData!.volume24h).toBeNull()
    expect(merged.dynamicData!.fees24h).toBeNull()
  })

  it('pool with REAL dynamicData (API pools) is never touched', () => {
    const pool = {
      address: '0x' + 'b'.repeat(40),
      dynamicData: { volume24h: '123.45', fees24h: '0.5' },
    }

    const merged = mergeOnchainPoolMetrics(pool as never, [])
    expect(merged.dynamicData!.volume24h).toBe('123.45')
    expect(merged.dynamicData!.fees24h).toBe('0.5')
  })

  it('enrichment also lifts totalLiquidity when provided', () => {
    const pool = {
      address: '0x' + 'c'.repeat(40),
      dynamicData: { volume24h: '0', fees24h: '0', totalLiquidity: '0' },
    }

    const enriched = {
      address: '0x' + 'c'.repeat(40),
      dynamicData: { volume24h: '1', fees24h: '0.01', totalLiquidity: '33.32' },
    }

    const merged = mergeOnchainPoolMetrics(pool as never, [enriched as never])
    expect(merged.dynamicData!.totalLiquidity).toBe('33.32')
  })

  it('original pool object is not mutated', () => {
    const pool = {
      address: '0x' + 'd'.repeat(40),
      dynamicData: { volume24h: '0', fees24h: '0' },
    }

    mergeOnchainPoolMetrics(pool as never, [])
    expect(pool.dynamicData.volume24h).toBe('0')
  })
})
