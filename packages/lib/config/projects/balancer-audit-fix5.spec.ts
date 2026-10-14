import { describe, expect, it } from 'vitest'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

/**
 * FIX-5 (F-03e): we did not deploy any CoW AMM factory — carrying
 * upstream's cowSupportedNetworks ([BASE, SEPOLIA(dev)]) misroutes the
 * create wizard to upstream's live bCoWFactory surface (which FIX-2/F-03b
 * removed from base.ts). Empty array = the CoW protocol option and
 * CowSwap links honestly disappear (ChooseNetwork/swap links read.includes()).
 */

describe('cowSupportedNetworks — honest removal (FIX-5)', () => {
  it('is empty (no CoW AMM factory deployed by Rootstock)', () => {
    expect(PROJECT_CONFIG.cowSupportedNetworks).toEqual([])
  })
})
