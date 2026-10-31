/**
 * Visitor-side pool-activity continuation scan (B4).
 *
 * Laws mirrored from scanSwapBuckets (onchain-metrics-io.ts, D3/B3):
 * - Scan starts from max(baked cursor, stored cursor) + 1 — never re-scans a
 *   covered range, so no source can double-count.
 * - PREFIX-RUN: the FIRST hole ends the contiguous run; post-hole logs are
 *   observed-only (display-grade, never persisted); the cursor only advances
 *   to coveredTo so the hole is re-attempted next visit.
 * - publicnode archive walls fall through to the Tenderly public gateway
 *   (subdivided); both fail = the chunk is a hole (never throws).
 *
 * One eth_getLogs per chunk with OR-topics [ADD, REMOVE, SWAP] AND the pool
 * address — all three activity types for one pool in a single query.
 */

import { T_LIQUIDITY_ADDED, T_LIQUIDITY_REMOVED, T_SWAP } from './onchain-pool-events'
import type { BakedPoolEvent } from './onchain-pool-events-builder'
import { ARCHIVE_FALLBACK_RPC } from './onchain-metrics-io'

export const ACTIVITY_TOPICS = [T_LIQUIDITY_ADDED, T_LIQUIDITY_REMOVED, T_SWAP]

/** Chunk sizes mirror the swap-ledger scan law (live-probed per chain). */
export const ACTIVITY_CHUNKS: Partial<Record<number, number>> = {
  8453: 5_000,
  84532: 200,
}

/**
 * Scan budget per visit (B4): a cold start (fresh bake cursor far behind
 * the tip) is PROGRESSIVE — the visitor scans at most this many chunks per
 * visit, the cursor advances through the covered prefix, and the next visit
 * continues. Bounded work per page view, full coverage across visits.
 */
export const ACTIVITY_MAX_CHUNKS: Partial<Record<number, number>> = {
  8453: 60,
  84532: 50,
}

export interface ActivityScanResult {
  /** Every observed log this scan (pre-hole included) — display-grade. */
  events: BakedPoolEvent[]
  /** Only the contiguous prefix-run — ledger-grade, may be persisted. */
  contiguousEvents: BakedPoolEvent[]
  /** End (inclusive) of the contiguous run; < fromBlock means nothing covered. */
  coveredTo: number
}

type RawLog = {
  blockNumber: string
  transactionHash: string
  logIndex: string
  topics: string[]
  data: string
}

/** Structural JSON-RPC client — the viem PublicClient and the fetch
 * fallback both satisfy it (cast once at the call site). */
export type ScanClient = {
  request: (args: { method: string; params: unknown[] }) => Promise<unknown>
}

const ARCHIVE_WALL_MARKERS = ['archive requests require', 'personal token', 'block range too large']

function isArchiveWallError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? '').toLowerCase()
  return ARCHIVE_WALL_MARKERS.some(m => msg.includes(m))
}

/** Tenderly public gateway fetch client (CORS-open) for archive-walled chunks. */
export function createActivityFallbackClient(chainId: number): ScanClient | undefined {
  const rpc = ARCHIVE_FALLBACK_RPC[chainId]
  if (!rpc) return undefined

  const request = async (args: { method: string; params: unknown[] }) => {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...args }),
    })

    const j = await res.json()
    if (j.error) throw new Error(String(j.error.message ?? j.error))
    return j.result
  }

  return { request }
}

function getRange(
  client: ScanClient,
  vault: string,
  pool: string,
  from: number,
  to: number
): Promise<RawLog[]> {
  return client.request({
    method: 'eth_getLogs',
    params: [
      {
        address: vault as `0x${string}`,
        topics: [ACTIVITY_TOPICS, [pool as `0x${string}`]],
        fromBlock: ('0x' + BigInt(from).toString(16)) as `0x${string}`,
        toBlock: ('0x' + BigInt(to).toString(16)) as `0x${string}`,
      },
    ],
  }) as Promise<RawLog[]>
}

/** Scan one chunk; null = hole. One transient retry; archive walls fall to fallback. */
async function scanChunk(
  client: ScanClient,
  fallbackClient: ScanClient | undefined,
  vault: string,
  pool: string,
  from: number,
  to: number,
  fallbackChunkSize: number
): Promise<RawLog[] | null> {
  let walled = false

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await getRange(client, vault, pool, from, to)
    } catch (err) {
      if (isArchiveWallError(err)) {
        walled = true
        break
      }
      // transient — retry once
    }
  }

  if (!walled || !fallbackClient) return null

  const subLogs: RawLog[] = []
  const subSize = Math.max(1, fallbackChunkSize)

  for (let f = from; f <= to; f += subSize) {
    const t = Math.min(f + subSize - 1, to)
    let done = false

    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      try {
        subLogs.push(...(await getRange(fallbackClient, vault, pool, f, t)))
        done = true
      } catch {
        // transient — retry once; second failure = hole
      }
    }

    if (!done) return null
  }

  return subLogs
}

function topicAddr(t: string): string {
  return '0x' + t.slice(-40).toLowerCase()
}

function words(data: string): string[] {
  const d = (data || '').slice(2)
  return Array.from({ length: Math.floor(d.length / 64) }, (_, i) => d.slice(i * 64, (i + 1) * 64))
}

/**
 * Decode one activity log into the raw BakedPoolEvent shape (no USD fields
 * — the builder prices events at display time). Never throws; null = unknown.
 */
export function decodeActivityLog(
  log: RawLog | null,
  blockTimestamps: Map<number, number>
): BakedPoolEvent | null {
  if (!log || !Array.isArray(log.topics) || log.topics.length < 4) return null

  const t0 = log.topics[0]!
  const block = parseInt(log.blockNumber, 16)

  const base = {
    pool: topicAddr(log.topics[1]!),
    tx: log.transactionHash,
    logIndex: parseInt(log.logIndex, 16),
    timestamp: blockTimestamps.get(block) ?? 0,
    block,
    userAddress: '0x' + '0'.repeat(40),
  }

  if (t0 === T_LIQUIDITY_ADDED || t0 === T_LIQUIDITY_REMOVED) {
    const w = words(log.data)
    if (w.length < 3) return null
    const amountsOffset = Number(BigInt('0x' + w[1]))
    const amountsHead = Math.floor(amountsOffset / 32)
    if (amountsHead + 1 > w.length) return null
    const amountsLen = Number(BigInt('0x' + w[amountsHead]))
    const amountsRaw: string[] = []

    for (let i = 0; i < amountsLen; i++) {
      const idx = amountsHead + 1 + i
      if (idx >= w.length) return null
      amountsRaw.push(BigInt('0x' + w[idx]).toString())
    }

    return {
      ...base,
      type: t0 === T_LIQUIDITY_ADDED ? 'ADD' : 'REMOVE',
      userAddress: topicAddr(log.topics[2]!),
      kind: Number(BigInt(log.topics[3]!)),
      totalSupply: BigInt('0x' + w[0]).toString(),
      amountsRaw,
    }
  }

  if (t0 === T_SWAP) {
    const w = words(log.data)
    if (w.length < 2) return null

    return {
      ...base,
      type: 'SWAP',
      tokenIn: topicAddr(log.topics[2]!),
      tokenOut: topicAddr(log.topics[3]!),
      amountInRaw: BigInt('0x' + w[0]).toString(),
      amountOutRaw: BigInt('0x' + w[1]).toString(),
      // Swap does not index the sender — tx.from backfilled by the caller
    }
  }

  return null
}

/**
 * Scan activity events for one pool since fromBlock (exclusive) with the
 * prefix-run law. Swaps backfill userAddress via getTxFrom (bounded, one
 * getTransaction per swap, best-effort zero-address on fail).
 */
export async function scanPoolActivity({
  client,
  fallbackClient,
  vault,
  pool,
  fromBlock,
  latestBlock,
  chunkSize,
  fallbackChunkSize = 1_000,
  maxChunks,
  getBlockTimestamp,
  getTxFrom,
}: {
  client: ScanClient
  fallbackClient?: ScanClient
  vault: string
  pool: string
  fromBlock: number
  latestBlock: number
  chunkSize: number
  fallbackChunkSize?: number
  /** Budget: stop after this many chunks (progressive continuation). */
  maxChunks?: number
  getBlockTimestamp: (block: number) => Promise<number | undefined>
  getTxFrom: (txHash: string) => Promise<string | undefined>
}): Promise<ActivityScanResult> {
  const allLogs: RawLog[] = []
  const prefixLogs: RawLog[] = []
  let prefixBroken = false
  let prefixEnd: number | null = null

  let chunksScanned = 0

  for (let from = fromBlock + 1; from <= latestBlock; from += chunkSize) {
    if (maxChunks !== undefined && chunksScanned >= maxChunks) break
    chunksScanned++
    const to = Math.min(from + chunkSize - 1, latestBlock)

    const chunkLogs = await scanChunk(
      client,
      fallbackClient,
      vault,
      pool,
      from,
      to,
      fallbackChunkSize
    )

    if (chunkLogs === null) {
      prefixBroken = true
      continue
    }

    allLogs.push(...chunkLogs)

    if (!prefixBroken) {
      prefixLogs.push(...chunkLogs)
      prefixEnd = to
    }
  }

  const emptyRange = fromBlock >= latestBlock
  const coveredTo = prefixEnd !== null ? prefixEnd : emptyRange ? fromBlock : fromBlock

  // one block timestamp per unique block (small set at our scale);
  // unknown -> 0 (honest fallback, mirrors the bake generator)
  const blockTimestamps = new Map<number, number>()

  for (const b of [...new Set(allLogs.map(l => parseInt(l.blockNumber, 16)))]) {
    const ts = await getBlockTimestamp(b)
    if (ts !== undefined) blockTimestamps.set(b, ts)
  }

  const decodeAll = (logs: RawLog[]): BakedPoolEvent[] => {
    const out: BakedPoolEvent[] = []

    for (const log of logs) {
      const e = decodeActivityLog(log, blockTimestamps)
      if (e) out.push(e)
    }

    return out
  }

  const events = decodeAll(allLogs)
  const contiguousEvents = decodeAll(prefixLogs)

  // backfill swap senders — best-effort; failure keeps zero-address
  // (the tx link still identifies the action; mirrors the bake generator)
  for (const e of events) {
    if (e.type !== 'SWAP') continue
    const from = await getTxFrom(e.tx)
    if (from) e.userAddress = from.toLowerCase()
  }

  for (const e of contiguousEvents) {
    if (e.type !== 'SWAP') continue
    const from = await getTxFrom(e.tx)
    if (from) e.userAddress = from.toLowerCase()
  }

  return { events, contiguousEvents, coveredTo }
}
