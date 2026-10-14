import { describe, expect, it, vi, beforeEach } from 'vitest'

// FIX-3 (F-03c): useVault must resolve vaultV3 from the network
// config (useContractAddress('balancer.vaultV3')) — the stale hardcoded
// 0x89aa…AE66 is NEITHER current vault (8453 0x0a3a…a0E7 / 84532 0xEf34…40c9).

const useContractAddressMock = vi.fn((id: string) => {
  if (id === 'balancer.vaultV2') return '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
  if (id === 'balancer.vaultV3') return '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7'
  throw new Error(`unexpected contract id: ${id}`)
})

vi.mock('@repo/lib/modules/web3/contracts/useContractAddress', () => ({
  useContractAddress: (id: string) => useContractAddressMock(id),
}))

import { useVault } from './useVault'

describe('useVault (FIX-3 — vaultV3 from network config)', () => {
  beforeEach(() => {
    useContractAddressMock.mockClear()
  })

  it('v3 resolves the vaultV3 network-config address', () => {
    const { vaultAddress } = useVault(3)
    expect(vaultAddress).toBe('0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7')
  })

  it('v2 resolves the vaultV2 network-config address', () => {
    const { vaultAddress } = useVault(2)
    expect(vaultAddress).toBe('0xBA12222222228d8Ba445958a75a0704d566BF2C8')
  })

  it('the stale 0x89aa…AE66 hardcode is gone (neither current vault)', () => {
    const { vaultAddress } = useVault(3)
    expect(vaultAddress).not.toBe('0x89aa28a8D2B327cD9dB4aDc0f259D757F000AE66')
  })

  it('reads vaultV3 through useContractAddress (config resolution, not literals)', () => {
    useVault(3)
    expect(useContractAddressMock).toHaveBeenCalledWith('balancer.vaultV3')
  })
})
