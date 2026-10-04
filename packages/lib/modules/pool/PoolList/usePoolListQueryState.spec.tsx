import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { act } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { usePoolListQueryState } from './usePoolListQueryState'

const testAddress = '0x000000000000000000000000000000000000dEaD'

describe('Pool list state query', () => {
  it('toggles joinablePools and updates total filter count', () => {
    const { result } = testHook(() => usePoolListQueryState(), {
      wrapper: withNuqsTestingAdapter({ searchParams: '?first=20&skip=0' }),
    })

    // S113d: default networks = both Rootstock chains (Base + BaseSepolia)
    expect(result.current.joinablePools).toBe(false)
    expect(result.current.totalFilterCount).toBe(2)
    expect(result.current.pagination.pageSize).toBe(20)
    expect(result.current.pagination.pageIndex).toBe(0)

    act(() => {
      result.current.toggleJoinablePools(true)
    })

    expect(result.current.joinablePools).toBe(true)
    expect(result.current.totalFilterCount).toBe(3)
    expect(result.current.pagination.pageSize).toBe(100)
    expect(result.current.pagination.pageIndex).toBe(0)

    act(() => {
      result.current.toggleJoinablePools(false)
    })

    expect(result.current.joinablePools).toBe(false)
    expect(result.current.pagination.pageSize).toBe(20)
    expect(result.current.pagination.pageIndex).toBe(0)
  })

  it('allows My positions and Joinable pools to be selected together', () => {
    const { result } = testHook(() => usePoolListQueryState(), {
      wrapper: withNuqsTestingAdapter(),
    })

    act(() => {
      result.current.toggleUserAddress(true, testAddress)
    })

    expect(result.current.userAddress).toBe(testAddress)
    expect(result.current.joinablePools).toBe(false)

    act(() => {
      result.current.toggleJoinablePools(true)
    })

    expect(result.current.joinablePools).toBe(true)
    expect(result.current.userAddress).toBe(testAddress)

    act(() => {
      result.current.toggleUserAddress(true, testAddress)
    })

    expect(result.current.userAddress).toBe(testAddress)
    expect(result.current.joinablePools).toBe(true)
  })

  it('resetFilters clears joinablePools', () => {
    const { result } = testHook(() => usePoolListQueryState(), {
      wrapper: withNuqsTestingAdapter(),
    })

    act(() => {
      result.current.toggleJoinablePools(true)
    })

    expect(result.current.joinablePools).toBe(true)

    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.joinablePools).toBe(false)
  })

  it('returns both-chains default totalFilterCount with no filters', () => {
    const { result } = testHook(() => usePoolListQueryState(), {
      wrapper: withNuqsTestingAdapter(),
    })

    // S113d: default networks = [Base, BaseSepolia] (both live Rootstock chains)
    expect(result.current.totalFilterCount).toBe(2)
  })
})
