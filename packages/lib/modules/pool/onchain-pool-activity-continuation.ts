/**
 * Onchain pool-activity continuation hook (B4, 2026-10-31).
 *
 * The baked events artifact (build-time archive scan) is the history base;
 * this hook extends it LIVE in the visitor's browser from the farthest
 * known cursor: localStorage store (per-pool) + fresh Vault getLogs scan
 * with the D3 prefix-run law (holes re-attempted next visit; post-hole
 * logs are display-grade). Onchain-only pools the remote API never serves
 * get their full activity from the chain — same source of truth as the
 * baked artifact, merged dedupe-safe by (type, tx, logIndex).
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { createMetricsClient } from './onchain-metrics-io'
import { getOnchainScanConfig } from './onchain-pool-discovery'
import {
  ACTIVITY_CHUNKS,
  ACTIVITY_MAX_CHUNKS,
  createActivityFallbackClient,
  scanPoolActivity,
  type ScanClient,
} from './onchain-activity-scan'
import {
  loadActivityStore,
  saveActivityStore,
  mergeActivityEvents,
  reconcileActivityStore,
  type ActivityStore,
} from './onchain-activity-store'
import type { BakedPoolEvent } from './onchain-pool-events-builder'
import bakedEventsBase from './baked-pool-events-base.json'
import bakedEventsSepolia from './baked-pool-events.json'

/** Raw baked artifact envelope (same shape both chains). */
interface BakedEventsFile {
  version: number
  chainId: number
  cursor: number
  events: BakedPoolEvent[]
}

function bakedForChain(chainId: number): BakedEventsFile | null {
  if (chainId === 8453) return bakedEventsBase as unknown as BakedEventsFile
  if (chainId === 84532) return bakedEventsSepolia as unknown as BakedEventsFile
  return null
}

export interface OnchainActivityResult {
  /** Merged events (baked + stored + fresh scan), newest-first. */
  events: BakedPoolEvent[]
  /** Chain tip scanned (0 when the scan was skipped/failed). */
  cursor: number
}

async function fetchOnchainActivity(
  chain: GqlChain,
  poolId: string
): Promise<OnchainActivityResult> {
  const scanConfig = getOnchainScanConfig(chain)
  const baked = scanConfig ? bakedForChain(scanConfig.chainId) : null
  if (!scanConfig || !baked) return { events: [], cursor: 0 }

  const pool = poolId.toLowerCase()
  const bakedPoolEvents = baked.events.filter(e => (e.pool || '').toLowerCase() === pool)

  const store = reconcileActivityStore(loadActivityStore(scanConfig.chainId, pool), baked.cursor)

  // structural JSON-RPC view of the viem client (loose typing; the scan
  // module owns the request shapes)
  const client = createMetricsClient(chain)
  const rpc = client as unknown as ScanClient | null

  // continuation law: start after the FARTHEST covered cursor — never
  // re-scan a covered range, so no source can double-count.
  const fromBlock = Math.max(baked.cursor, store?.cursor ?? 0, scanConfig.fromBlock)

  let fresh: Awaited<ReturnType<typeof scanPoolActivity>> | null = null

  if (rpc) {
    const latest = Number((await rpc.request({ method: 'eth_blockNumber', params: [] })) as string)

    if (fromBlock < latest) {
      fresh = await scanPoolActivity({
        client: rpc,
        fallbackClient: createActivityFallbackClient(scanConfig.chainId),
        vault: scanConfig.vault,
        pool,
        fromBlock,
        latestBlock: latest,
        chunkSize: ACTIVITY_CHUNKS[scanConfig.chainId] ?? 500,
        maxChunks: ACTIVITY_MAX_CHUNKS[scanConfig.chainId],
        getBlockTimestamp: async b => {
          try {
            const blk = (await rpc.request({
              method: 'eth_getBlockByNumber',
              params: ['0x' + b.toString(16), false],
            })) as { timestamp?: string } | null

            return blk?.timestamp ? Number(BigInt(blk.timestamp)) : undefined
          } catch {
            return undefined
          }
        },
        getTxFrom: async hash => {
          try {
            const tx = (await rpc.request({
              method: 'eth_getTransactionByHash',
              params: [hash],
            })) as { from?: string } | null

            return tx?.from || undefined
          } catch {
            return undefined
          }
        },
      })

      // persist ONLY the contiguous prefix-run (D3 law) — holes are
      // re-attempted next visit; post-hole events stay display-grade.
      if (fresh.coveredTo > fromBlock) {
        const next: ActivityStore = {
          version: 1,
          chainId: scanConfig.chainId,
          poolId: pool,
          cursor: fresh.coveredTo,
          savedAt: Date.now(),
          events: mergeActivityEvents(store?.events ?? [], fresh.contiguousEvents),
        }

        saveActivityStore(next)
      }
    }
  }

  // display merge: baked history + persisted prefix + every observed log
  const merged = mergeActivityEvents(
    bakedPoolEvents,
    mergeActivityEvents(store?.events ?? [], fresh?.events ?? [])
  )

  return {
    events: merged,
    cursor: fresh?.coveredTo ?? store?.cursor ?? fromBlock,
  }
}

export function useOnchainPoolActivity(
  enabled: boolean,
  chain: GqlChain | undefined,
  poolId: string | undefined
) {
  return useQuery<OnchainActivityResult>({
    queryKey: ['onchain-pool-activity', chain, poolId],
    queryFn: () => fetchOnchainActivity(chain as GqlChain, poolId as string),
    enabled:
      enabled &&
      !!chain &&
      !!poolId &&
      (chain === GqlChainValues.Base || chain === GqlChainValues.BaseSepolia) &&
      isOnchainOnlyNetwork(chain),
    staleTime: 60_000,
    // Live activity: incremental continuation from the stored cursor keeps
    // the table fresh without refocus (new swaps appear within 30s).
    refetchInterval: 30_000,
  })
}
