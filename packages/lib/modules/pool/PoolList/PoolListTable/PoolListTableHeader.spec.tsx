import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PoolListTableHeader } from './PoolListTableHeader'
import { YieldWindow } from '../../pool.types'

/**
 * S134b (2026-11-01): the shared window pill under APR is dead — APR and
 * Volume each own an INDEPENDENT window, selected from a caret dropdown
 * on their own column header (boss-approved design). The header label
 * always names the window it renders; the caret never triggers a sort.
 */

vi.mock('../PoolListProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('../PoolListProvider')>()
  return { ...actual, usePoolList: vi.fn() }
})

vi.mock('@repo/lib/shared/components/tables/SortableHeader', () => ({
  SortableHeader: ({
    label,
    buttonProps,
    containerProps,
  }: {
    label: string
    buttonProps?: unknown
    containerProps?: unknown
  }) => (
    <button
      data-button-props={JSON.stringify(buttonProps ?? null)}
      data-container-props={JSON.stringify(containerProps ?? null)}
      data-label={label}
      data-testid="sortable-header"
    >
      {label}
    </button>
  ),
  Sorting: { asc: 'asc', desc: 'desc' },
}))

import { usePoolList } from '../PoolListProvider'

const mockedUsePoolList = vi.mocked(usePoolList)

const mockSetSorting = vi.fn()
const mockSetAprWindow = vi.fn()
const mockSetVolumeWindow = vi.fn()

const renderHeader = (aprWindow: YieldWindow, volumeWindow: YieldWindow) => {
  mockedUsePoolList.mockReturnValue({
    queryState: {
      sorting: [{ id: 'totalLiquidity', desc: true }],
      setSorting: mockSetSorting,
      joinablePools: false,
      userAddress: undefined,
    },
    aprWindow,
    setAprWindow: mockSetAprWindow,
    volumeWindow,
    setVolumeWindow: mockSetVolumeWindow,
  } as unknown as ReturnType<typeof usePoolList>)

  return render(<PoolListTableHeader />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PoolListTableHeader — independent per-column windows (S134b)', () => {
  it('labels each windowed column with its own window', () => {
    renderHeader(YieldWindow.W24h, YieldWindow.W7d)
    expect(screen.getByText('APR (24h)')).toBeTruthy()
    expect(screen.getByText('Volume (7d)')).toBeTruthy()
  })

  it('renders no window pill chips (the shared selector is dead)', () => {
    renderHeader(YieldWindow.W7d, YieldWindow.W7d)

    // Chips render as role="group" (Chakra ButtonGroup), not role="button"
    // — a buttons-only guard passes pre-change (falsely). Guard on exact
    // chip text and the WINDOW chip ids (the Name/Tokens toggle legitimately
    // keeps its own button-group-name/token-pills ids — approved design).
    // Exclude caret-menu items (role="menuitem") — Chakra may keep their
    // text mounted while the menu is closed; only visible CHIP text counts.
    for (const pill of ['24h', '7d', '30d', 'Life']) {
      const chipMatches = screen
        .queryAllByText(pill, { exact: true })
        .filter(el => !el.closest('[role="menuitem"]'))

      expect(chipMatches.length).toBe(0)
    }

    for (const id of [
      'button-group-24h',
      'button-group-7d',
      'button-group-30d',
      'button-group-lifetime',
    ]) {
      expect(document.getElementById(id)).toBeNull()
    }
  })

  it('windowed header labels carry mobile-wrap props; TVL carries none (approved mock: two-line Volume/(7d))', () => {
    renderHeader(YieldWindow.W7d, YieldWindow.W7d)
    // Chakra responsive props compile to emotion CSS that jsdom cannot
    // honestly resolve (getComputedStyle and CSSOM scans both proved
    // dishonest here). Honest unit law: the CONTRACT — windowed columns
    // receive the wrap/shrink props, non-windowed columns receive none.
    // The visual wrap itself is proven live post-deploy (geometry probe +
    // vision), where emotion media queries actually apply.
    const headers = [...screen.getAllByTestId('sortable-header')]
    const byLabel = (label: string) => headers.find(h => h.dataset.label === label)

    const vol = byLabel('Volume (7d)')
    const apr = byLabel('APR (7d)')
    const tvl = byLabel('TVL')
    expect(vol).toBeTruthy()
    expect(apr).toBeTruthy()
    expect(tvl).toBeTruthy()

    const buttonPropsOf = (el: Element) =>
      JSON.parse((el as HTMLElement).dataset.buttonProps || 'null')

    const containerPropsOf = (el: Element) =>
      JSON.parse((el as HTMLElement).dataset.containerProps || 'null')

    // windowed labels: base (mobile) allows wrap + shrink, md+ restored
    for (const el of [vol!, apr!]) {
      const bp = buttonPropsOf(el)
      const cp = containerPropsOf(el)
      expect(bp).toBeTruthy()
      expect(cp).toBeTruthy()
      expect(bp.whiteSpace).toEqual({ base: 'normal', md: 'nowrap' })
      expect(bp.minW).toEqual({ base: '0', md: 'auto' })
      expect(bp.maxW).toEqual({ base: '100%', md: 'none' })
      expect(cp.minW).toEqual({ base: '0', md: 'auto' })
    }

    // non-windowed columns keep upstream behavior — no wrap props leak
    expect(buttonPropsOf(tvl!)).toBeNull()
    expect(containerPropsOf(tvl!)).toBeNull()
  })

  it('APR caret menu sets only the APR window', async () => {
    renderHeader(YieldWindow.W7d, YieldWindow.W7d)
    fireEvent.click(screen.getByRole('button', { name: 'APR window' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '30d' }))
    expect(mockSetAprWindow).toHaveBeenCalledWith(YieldWindow.W30d)
    expect(mockSetVolumeWindow).not.toHaveBeenCalled()
    // the caret never sorts — sorting stays untouched
    expect(mockSetSorting).not.toHaveBeenCalled()
  })

  it('Volume caret menu sets only the Volume window', async () => {
    renderHeader(YieldWindow.W7d, YieldWindow.W7d)
    fireEvent.click(screen.getByRole('button', { name: 'Volume window' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '24h' }))
    expect(mockSetVolumeWindow).toHaveBeenCalledWith(YieldWindow.W24h)
    expect(mockSetAprWindow).not.toHaveBeenCalled()
    // the caret never sorts — sorting stays untouched
    expect(mockSetSorting).not.toHaveBeenCalled()
  })
})
