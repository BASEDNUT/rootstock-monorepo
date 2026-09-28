import { describe, expect, it } from 'vitest'
import { toEventSelector } from 'viem'
import {
  FACTORY_SCAN_FROM_BLOCK,
  TOKEN_CREATED_TOPIC0,
  TOKEN_FACTORY,
  WRAPPER_CREATED_TOPIC0,
  WRAPPER_FACTORY,
} from './primitives.config'
import { tokenFactoryAbi, wrapperFactoryAbi } from './primitivesAbi'
import { PRIMITIVE_ERROR_SELECTORS } from './primitive-errors'

/**
 * S106: primitive factories wiring laws. Sources:
 * - Addresses + deploy block: rootstock/LIVE_DEPLOYMENTS.md (20260927-primitives-factories, receipt-verified S105)
 * - ABIs: src/primitives/{TokenFactory,WrapperFactory}.sol (byte-exact verified)
 * - Event topics: keccak of event signatures
 */
describe('primitive factories config (S106)', () => {
  it('factory addresses match the deployment ledger', () => {
    expect(TOKEN_FACTORY.toLowerCase()).toBe('0xb27d38f0968c334c8b7d3496d5d8e7afb80f4b13')
    expect(WRAPPER_FACTORY.toLowerCase()).toBe('0x678a8f6ad8887de4323ca49bc261043e67850dc7')
  })

  it('event topics are keccak-exact', () => {
    expect(TOKEN_CREATED_TOPIC0).toBe(
      toEventSelector('TokenCreated(address,address,string,string,uint256)')
    )

    expect(WRAPPER_CREATED_TOPIC0).toBe(
      toEventSelector('WrapperCreated(address,address,address,string,string)')
    )
  })

  it('scan starts at the verified deploy block', () => {
    expect(FACTORY_SCAN_FROM_BLOCK).toBe(47_381_481)
  })
})

describe('primitive factory ABIs', () => {
  it('token factory exposes create + TokenCreated + custom errors', () => {
    const names = (tokenFactoryAbi as unknown as { name?: string }[]).map(e => e.name)
    expect(names).toContain('create')
    expect(names).toContain('TokenCreated')
    expect(names).toContain('TokenFactory__ZeroSupply')
    expect(names).toContain('TokenFactory__EmptyName')
    expect(names).toContain('TokenFactory__EmptySymbol')
  })

  it('wrapper factory exposes create + WrapperCreated + custom errors', () => {
    const names = (wrapperFactoryAbi as unknown as { name?: string }[]).map(e => e.name)
    expect(names).toContain('create')
    expect(names).toContain('WrapperCreated')
    expect(names).toContain('WrapperFactory__NotAContract')
    expect(names).toContain('WrapperFactory__EmptyName')
    expect(names).toContain('WrapperFactory__EmptySymbol')
  })
})

describe('primitive error translation map', () => {
  const SIGNATURES = [
    'TokenFactory__ZeroSupply()',
    'TokenFactory__EmptyName()',
    'TokenFactory__EmptySymbol()',
    'WrapperFactory__NotAContract(address)',
    'WrapperFactory__EmptyName()',
    'WrapperFactory__EmptySymbol()',
  ]

  it('every custom error has a keccak-derived selector entry', () => {
    for (const sig of SIGNATURES) {
      const selector = toEventSelector(sig).slice(0, 10)
      const msg = PRIMITIVE_ERROR_SELECTORS[selector]
      expect(typeof msg, `selector ${selector} for ${sig}`).toBe('string')
      expect(msg!.length).toBeGreaterThan(0)
    }
  })
})
