/**
 * Rootstock primitive factories config (S106).
 *
 * Sources (all verified S105, rootstock/LIVE_DEPLOYMENTS.md 20260927-primitives-factories):
 * - TokenFactory + WrapperFactory deployed on Base Sepolia (84532) at block 47,381,481
 * - Event topics verified against live chain logs (sepolia.base.org, 2026-09-28)
 * - Custom error selectors keccak-derived from source signatures
 */

/** TokenFactory — Base Sepolia (receipt 0x9b6e52fc…f614b, status 0x1). */
export const TOKEN_FACTORY = '0xB27D38F0968C334C8B7D3496D5D8E7afB80f4b13'

/** WrapperFactory — Base Sepolia (receipt 0x738f785d…be661f, status 0x1). */
export const WRAPPER_FACTORY = '0x678a8F6AD8887De4323CA49Bc261043E67850dC7'

/** keccak256('TokenCreated(address,address,string,string,uint256)') — live-log verified. */
export const TOKEN_CREATED_TOPIC0 =
  '0x6e6ae68e7d7d45fbd855c40d1eaafa8de46c5fbec3ee26f1af88730e400bc92c'

/** keccak256('WrapperCreated(address,address,address,string,string)') — live-log verified. */
export const WRAPPER_CREATED_TOPIC0 =
  '0x5d2e6317a2308779da9f0a8be12031853fc4d99c08ca5b72d60fe80088be254e'

/** Both factories deployed at this block (S105 ledger). Scan starts here. */
export const FACTORY_SCAN_FROM_BLOCK = 47_381_481

/** Scan chunk when a wide-range getLogs is rejected (house pattern, S100). */
export const FACTORY_SCAN_CHUNK = 1_000

/** Base Sepolia chain id (our deployment — LIVE_DEPLOYMENTS.md). */
export const PRIMITIVES_CHAIN_ID = 84532

/** Block explorer base for links (Base Sepolia). */
export const BASESEPOLIA_BLOCK_EXPLORER = 'https://sepolia.basescan.org'
