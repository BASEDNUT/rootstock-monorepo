import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { PoolListTableRow } from './PoolListTableRow'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

// Local window shape — mirrors computeYieldWindows output. pool-metrics
// exports no YieldWindows type; importing the hook result type would couple
// this spec to the hook module.
type WindowMetrics = { apr: number | null; volumeUsd: number | null }
type YieldWindows = {
  w24h: WindowMetrics
  w7d: WindowMetrics
  w30d: WindowMetrics
  lifetime: WindowMetrics
}

/**
 * S134b (2026-11-01): APR and Volume render by their OWN window — the APR
 * cell follows aprWindow, the Volume cell follows volumeWindow, and the two
 * are fully independent (boss-caught: a shared window under APR silently
 * changed Volume; display must follow its own header, not a foreign one).
 */

vi.mock('../PoolListProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('../PoolListProvider')>()
  return { ...actual, usePoolList: vi.fn() }
})

vi.mock('@repo/lib/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({ toCurrency: (v: number) => `$${v}` }),
}))

vi.mock('@repo/lib/shared/utils/numbers', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/shared/utils/numbers')>()
  return { ...actual, fNum: vi.fn((_tag: string, v: number) => `APR:${v}`) }
})

vi.mock('../../metadata/usePoolMetadata', () => ({
  usePoolMetadata: () => ({ name: 'Mock Pool' }),
}))

vi.mock('../../tags/PoolTagsProvider', () => ({
  usePoolTags: () => ({ getPoolTags: () => [] }),
}))

vi.mock('../../user-balance.helpers', () => ({
  getUserTotalBalanceUsd: () => 0,
}))

vi.mock('../../pool.utils', () => ({
  getPoolPath: () => '/pool/mock',
}))

vi.mock('../../PoolListPoolDisplay', () => ({
  PoolListPoolDisplay: () => null,
}))

vi.mock('./PoolListTableDetailsCell', () => ({
  PoolListTableDetailsCell: () => null,
}))

vi.mock('@repo/lib/shared/components/containers/FadeInOnView', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@repo/lib/shared/components/tooltips/TooltipWithTouch', () => ({
  TooltipWithTouch: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@repo/lib/shared/components/icons/NetworkIcon', () => ({
  NetworkIcon: () => null,
}))

import { usePoolList } from '../PoolListProvider'
import type { PoolListItem } from '../../pool.types'

const mockedUsePoolList = vi.mocked(usePoolList)

const windows: YieldWindows = {
  w24h: { apr: 0.42, volumeUsd: 1.54 },
  w7d: { apr: 0.11, volumeUsd: 8.31 },
  w30d: { apr: 0.31, volumeUsd: 55.0 },
  lifetime: { apr: 0.23, volumeUsd: 52.27 },
}

const mockPool = (w?: YieldWindows) =>
  ({
    id: '0xabc0000000000000000000000000000000000001',
    address: '0xabc0000000000000000000000000000000000001',
    chain: GqlChainValues.BaseSepolia,
    type: 'WEIGHTED',
    protocolVersion: 3,
    symbol: 'MOCK-80/20',
    name: 'Mock Pool',
    createTime: 47_000_000,
    poolTokens: [],
    tags: [],
    dynamicData: {
      totalLiquidity: '10',
      volume24h: '5',
      fees24h: '0',
      aprItems: [],
    },
    ...(w ? { yieldWindows: w } : {}),
  }) as unknown as PoolListItem

const renderRow = (aprWindow: string, volumeWindow: string, w?: YieldWindows) => {
  mockedUsePoolList.mockReturnValue({
    queryState: { joinablePools: false, userAddress: undefined },
    hasWalletTokenBalance: () => false,
    poolDisplayType: 'name',
    aprWindow,
    volumeWindow,
    setAprWindow: vi.fn(),
    setVolumeWindow: vi.fn(),
  } as unknown as ReturnType<typeof usePoolList>)

  return render(<PoolListTableRow keyValue={0} pool={mockPool(w)} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PoolListTableRow — independent per-column windows (S134b)', () => {
  it('APR cell renders the aprWindow value while Volume renders the volumeWindow value', () => {
    const { container, getByTitle } = renderRow('24h', '7d', windows)
    expect(container.textContent).toContain('APR:0.42')
    expect(getByTitle('$8.31')).toBeTruthy()
  })

  it('APR window change moves the APR cell, never the Volume cell', () => {
    const { container, getByTitle } = renderRow('lifetime', '7d', windows)
    expect(container.textContent).toContain('APR:0.23')
    expect(getByTitle('$8.31')).toBeTruthy()
  })

  it('Volume window change moves the Volume cell, never the APR cell', () => {
    const { container, getByTitle } = renderRow('24h', '30d', windows)
    expect(container.textContent).toContain('APR:0.42')
    expect(getByTitle('$55')).toBeTruthy()
  })

  it('onchain pool without windows renders honest dashes, volume falls back to fixed 24h', () => {
    const { container, getByTitle } = renderRow('24h', '7d', undefined)
    // fNum is only called for non-null APR — null renders a bare dash
    expect(container.textContent).toContain('—')
    expect(container.textContent).not.toContain('APR:')
    expect(getByTitle('$5')).toBeTruthy()
  })
})
