/**
 * Anvil fork constants shared by the dev/test harness and production wiring.
 * Single source: the test tree re-exports these; production modules import
 * them directly and never depend on the test tree.
 */
export const defaultAnvilAccount = '0x3B7D260597A3e3f90274563a9e481618C6B951Eb'
export const defaultAnvilForkRpcUrl = 'http://127.0.0.1:8545'
export const impersonatedAddressStorageKey = 'impersonated-address'
