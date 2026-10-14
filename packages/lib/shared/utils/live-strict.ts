/**
 * ROOTSTOCK_LIVE_STRICT error classification.
 *
 * Live suites (real chains, public RPCs) run in two modes:
 * - Default (ROOTSTOCK_LIVE_STRICT unset): vitest-skipped entirely — no
 *   public-RPC dependence in the default CI suite.
 * - Strict (ROOTSTOCK_LIVE_STRICT=1): the suite RUNS against the real chain.
 *   Failures must be split:
 *   - Infrastructure (fetch/connection/429/timeout/DNS): the live target is
 *     unreachable, the code is not proven broken → explicit vitest.skip with
 *     a visible warning (skips are counted and reported by vitest).
 *   - Logic/assertion/contract errors (revert selectors, failed
 *     expectations, invalid shapes): THROW — strict mode fails the run.
 */

export type LiveStrictDecision =
  | { action: 'skip'; reason: string; error: Error }
  | { action: 'throw'; reason: string; error: Error }

/** Infrastructure failure signatures (lowercase substring match). */
const INFRASTRUCTURE_PATTERNS: string[] = [
  'fetch failed',
  'network timeout',
  'timed out',
  'timeout',
  'econnrefused',
  'econnreset',
  'enotfound',
  'eai_again',
  'socket hang up',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'http 429',
  '429',
  'rate limit',
  'too many requests',
  'http 502',
  'http 503',
  'http 504',
]

/**
 * True when the error is an INFRASTRUCTURE failure (the live target is
 * unreachable). RPC method errors, reverts, failed expectations and empty
 * messages are logic failures — strict mode must throw on them, not skip.
 */
export function isLiveInfrastructureError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase().trim()
  if (!message) return false

  return INFRASTRUCTURE_PATTERNS.some(p => message.includes(p))
}

/**
 * Classify a live-strict failure into a skip (infrastructure) or throw
 * (logic) decision. Non-Error throwables are logic failures — fail loud.
 */
export function classifyLiveStrictError(error: unknown): LiveStrictDecision {
  const normalized = error instanceof Error ? error : new Error(String(error))

  if (error instanceof Error && isLiveInfrastructureError(error)) {
    return {
      action: 'skip',
      reason: `live target unreachable (infrastructure): ${error.message}`,
      error,
    }
  }

  return {
    action: 'throw',
    reason: `live logic failure: ${normalized.message}`,
    error: normalized,
  }
}
