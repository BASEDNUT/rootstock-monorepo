/* global setTimeout, URL, console, process */
// Rootstock: generates the baked SWAP-EVENT LEDGER (hourly volume/fee
// buckets per pool+token) from full onchain history via an archive RPC.
// Companion to generate-baked-registry.mjs — same chain configs, same
// retry laws (gateway 429 backoff, sequential chunks).
// Usage: node generate-baked-swap-ledger.mjs [--chain base-sepolia|base]
//
// Fee source truth (frozen V3 Vault.sol _computeAndChargeAggregateSwapFees):
// _aggregateFeeAmounts stores ONLY the aggregate (protocol+creator) share —
// with aggregate % = 0 the counters stay 0 forever. The Swap EVENT carries
// the FULL swapFeeAmount + amountIn (both in tokenIn) — it is the only
// complete fee/volume source. This ledger is what computePoolMetrics()
// consumes (onchain-metrics.ts).
import { writeFileSync } from 'fs'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'

const SWAP_TOPIC0 = '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db'
const HOUR_MS = 3_600_000

const CHAIN_CONFIGS = {
  'base-sepolia': {
    chainId: 84532,
    vault: '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9',
    rpc: 'https://sepolia.base.org',
    viemChain: baseSepolia,
    from: 46_984_000,
    chunk: 200,
    blockMs: 2_000,
    output: 'baked-swap-ledger.json',
  },
  base: {
    chainId: 8453,
    vault: '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
    // publicnode archive getLogs is token-gated; the Tenderly public
    // gateway serves 1000-block archive ranges (same law as the registry
    // generator).
    rpc: 'https://base.gateway.tenderly.co',
    viemChain: base,
    from: 52_131_550,
    chunk: 1_000,
    blockMs: 2_000,
    output: 'baked-swap-ledger-base.json',
  },
}

const chainArg = process.argv.includes('--chain')
  ? process.argv[process.argv.indexOf('--chain') + 1]
  : 'base'
const config = CHAIN_CONFIGS[chainArg]
if (!config) {
  console.error('Unknown chain:', chainArg, '- use --chain base-sepolia|base')
  process.exit(1)
}

const client = createPublicClient({ chain: config.viemChain, transport: http(config.rpc) })

// gateway 429s occasionally under sustained scans — retry with backoff.
async function rpcRetry(fn, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise(r => setTimeout(r, 2000 * (i + 1)))
    }
  }
}

const latest = Number(await client.getBlockNumber())
console.log('latest block:', latest)

// 1. scan Swap events full-history (newest → oldest, chunked)
const logs = []
for (let to = latest; to > config.from; to -= config.chunk) {
  const from = to - config.chunk >= config.from ? to - config.chunk : config.from
  const raw = await rpcRetry(() =>
    client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: config.vault,
          topics: [SWAP_TOPIC0],
          fromBlock: '0x' + from.toString(16),
          toBlock: '0x' + to.toString(16),
        },
      ],
    })
  )
  for (const l of raw) logs.push(l)
  if (logs.length && logs.length % 50 === 0) console.log('scanned to block', from, '-', logs.length, 'swaps')
}
console.log('total swap events:', logs.length)

// 2. bucket by hour|pool|tokenIn
const bakedAt = Date.now()
const blockToMs = block => bakedAt - (latest - block) * config.blockMs
const map = new Map()
for (const l of logs) {
  if (!l.topics || l.topics.length < 4) continue
  const data = (l.data || '').slice(2)
  if (data.length < 4 * 64) continue
  const pool = ('0x' + l.topics[1].slice(-40)).toLowerCase()
  const token = ('0x' + l.topics[2].slice(-40)).toLowerCase()
  const amountInRaw = BigInt('0x' + data.slice(0, 64))
  const feeAmountRaw = BigInt('0x' + data.slice(3 * 64, 4 * 64))
  const hour = Math.floor(blockToMs(parseInt(l.blockNumber, 16)) / HOUR_MS)
  const key = `${hour}|${pool}|${token}`
  const ex = map.get(key)
  if (ex) {
    ex.amountInRaw = (BigInt(ex.amountInRaw) + amountInRaw).toString()
    ex.feeAmountRaw = (BigInt(ex.feeAmountRaw) + feeAmountRaw).toString()
  } else {
    map.set(key, {
      hour,
      pool,
      token,
      amountInRaw: amountInRaw.toString(),
      feeAmountRaw: feeAmountRaw.toString(),
    })
  }
}

// 3. coverage start = deploy-block timestamp (approx via block math)
const coverageStartMs = blockToMs(config.from)

const out = {
  version: 1,
  chainId: config.chainId,
  cursor: latest,
  savedAt: bakedAt,
  coverageStartMs,
  buckets: [...map.values()].sort((a, b) => a.hour - b.hour),
}
writeFileSync(new URL(`./${config.output}`, import.meta.url), JSON.stringify(out))
console.log('wrote', config.output, '-', out.buckets.length, 'hourly buckets, coverage from', new Date(coverageStartMs).toISOString())
