import { render } from '@testing-library/react'
import { LbpPoolListInfo } from './LbpPoolListInfo'
import { PoolListItem } from '../pool.types'

/**
 * S100b audit fix F3 (2026-09-23): baked/onchain pools carry no lbpParams.
 * Without a guard, startTime=0 → epoch-0 math rendered 'Starts: -497283h'
 * on LBP rows in the static export (browser-verified defect).
 */
describe('LbpPoolListInfo — missing lbpParams guard', () => {
  it('renders nothing when pool has no lbpParams (baked/onchain pools)', () => {
    const pool = {} as unknown as PoolListItem
    const { container } = render(<LbpPoolListInfo pool={pool} />)
    expect(container.textContent).toBe('')
  })

  it('renders nothing when lbpParams startTime/endTime are 0', () => {
    const pool = {
      lbpParams: { startTime: 0, endTime: 0 },
    } as unknown as PoolListItem

    const { container } = render(<LbpPoolListInfo pool={pool} />)
    expect(container.textContent).toBe('')
  })

  it('renders a positive Starts countdown when startTime is in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 7200 // +2h

    const pool = {
      lbpParams: { startTime: future, endTime: future + 3600 },
    } as unknown as PoolListItem

    const { container } = render(<LbpPoolListInfo pool={pool} />)
    expect(container.textContent).toContain('Starts:')
    expect(container.textContent).not.toContain('-')
  })

  it('renders Ends countdown while sale is ongoing', () => {
    const past = Math.floor(Date.now() / 1000) - 3600 // started 1h ago

    const pool = {
      lbpParams: { startTime: past, endTime: past + 7200 },
    } as unknown as PoolListItem

    const { container } = render(<LbpPoolListInfo pool={pool} />)
    expect(container.textContent).toContain('Ends:')
  })

  it('renders Ended when both times are past', () => {
    const past = Math.floor(Date.now() / 1000) - 7200

    const pool = {
      lbpParams: { startTime: past, endTime: past + 3600 },
    } as unknown as PoolListItem

    const { container } = render(<LbpPoolListInfo pool={pool} />)
    expect(container.textContent).toContain('Ended')
  })
})
