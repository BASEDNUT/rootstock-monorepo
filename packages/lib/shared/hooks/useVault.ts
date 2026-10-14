import { useContractAddress } from '@repo/lib/modules/web3/contracts/useContractAddress'

export type VaultVersion = 2 | 3

export function useVault(version: VaultVersion | number) {
  const vaultV2Address = useContractAddress('balancer.vaultV2')
  // FIX-3 (F-03c): resolve vaultV3 from the network config — the old
  // hardcoded 0x89aa…AE66 was stale (neither current vault: 8453
  // 0x0a3a…a0E7 / 84532 0xEf34…40c9). Both our network configs carry
  // vaultV3 (base.ts FIX-2 + existing baseSepolia.ts).
  const vaultV3Address = useContractAddress('balancer.vaultV3')
  const vaultAddress = version === 3 ? vaultV3Address : vaultV2Address

  return {
    vaultAddress,
  }
}
