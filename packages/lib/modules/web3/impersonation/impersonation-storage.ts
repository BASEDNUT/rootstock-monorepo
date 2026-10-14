import { Address, isAddress } from 'viem'
import { impersonatedAddressStorageKey } from './fork-constants'

/**
 * Impersonation address persistence (localStorage). Production-owned: the
 * disconnect cleanup reads it; the dev harness re-exports it.
 */
function isLocalStorageAvailable() {
  return typeof localStorage !== 'undefined'
}

export function setImpersonatedAddressLS(impersonatedAddress: string) {
  if (!isLocalStorageAvailable()) return
  localStorage.setItem(impersonatedAddressStorageKey, impersonatedAddress)
}

export function getSavedImpersonatedAddressLS(): Address | undefined {
  if (!isLocalStorageAvailable()) return undefined
  const result = localStorage.getItem(impersonatedAddressStorageKey)
  return result && isAddress(result) ? result : undefined
}

export function clearImpersonatedAddressLS() {
  if (!isLocalStorageAvailable()) return
  localStorage.removeItem(impersonatedAddressStorageKey)
}
