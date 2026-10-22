/* global setTimeout, URL, console, process, writeFileSync */
// Rootstock: generates the baked POOL ACTIVITY EVENTS ledger (adds/removes/
// swaps per pool) from full onchain history via an archive RPC — same laws
// as generate-baked-registry.mjs (Tenderly gateway, chunked, 429 backoff).
// The remote API never knows our pools — activity comes from the chain.
//
// Event truth (frozen V3 IVaultEvents.sol + live-verified 2026-10-21):
//   LiquidityAdded(address indexed pool, address indexed liquidityProvider,
//     uint8 indexed kind, uint256 totalSupply, uint256[] amountsAddedRaw,
//     uint256[] swapFeeAmountsRaw) — topic0 a26a52d8...
//   LiquidityRemoved — decodes identically — topic0 8ce0d53c... (no events
//   yet on our pools; bake covers the future)
//   Swap(address indexed pool, IERC20 indexed tokenIn, IERC20 indexed
//     tokenOut, uint256 amountIn, uint256 amountOut, uint256
//     swapFeePercentage, uint256 swapFeeAmount) — topic0 0874b2d5...
// Usage: node generate-baked-pool-events.mjs [--chain base|base-sepolia]
import { writeFileSync } from 'fs'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'

const T_ADD = '0xa26a52d8d53702bba7f137907b8e1f99ff87f6d450144270ca25e72481cca871'
const T_REMOVE = '0x8ce0d53c0b010debc14b5e112019f61530364db7f9957ae0422dd17f4e95b870'
const T_SWAP = '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db'

const CHAIN_CONFIGS = {
  'base-sepolia': {
    chainId: 84532,
    vault: '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9',
    rpc: 'https://sepolia.base.org',
    viemChain: baseSepolia,
    // the only live sepolia pool was created at 47265032 (baked registry
    // truth) — scan from pool creation, not vault deploy
    from: 47_264_000,
    chunk: 200, // sepolia.base.org getLogs limit is 200 (live-probed)
    output: 'baked-pool-events.json',
  },
  base: {
    chainId: 8453,
    vault: '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
    rpc: 'https://base.gateway.tenderly.co',
    viemChain: base,
    from: 52_131_550,
    chunk: 1_000,
    output: 'baked-pool-events-base.json',
  },
}

const chainArg = process.argv.includes('--chain')
  ? process.argv[process.argv.indexOf('--chain') + 1]
  : 'base'
const config = CHAIN_CONFIGS[chainArg]
if (!config) {
  console.error('Unknown chain:', chainArg, '- use --chain base|base-sepolia')
  process.exit(1)
}

const client = createPublicClient({ chain: config.viemChain, transport: http(config.rpc) })

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

// 1. scan the three activity topics full-history
const logs = []
for (const topic of [T_ADD, T_REMOVE, T_SWAP]) {
  let n = 0
  for (let from = config.from; from <= latest; from += config.chunk) {
    const to = Math.min(from + config.chunk - 1, latest)
    const raw = await rpcRetry(() =>
      client.request({
        method: 'eth_getLogs',
        params: [
          {
            address: config.vault,
            topics: [topic],
            fromBlock: '0x' + from.toString(16),
            toBlock: '0x' + to.toString(16),
          },
        ],
      })
    )
    logs.push(...raw)
    n += raw.length
  }
  console.log('topic', topic.slice(0, 10), '->', n, 'events')
}
console.log('total activity events:', logs.length)

// 2. block timestamps for event blocks
const blocks = [...new Set(logs.map(l => parseInt(l.blockNumber, 16)))]
const ts = {}
for (const b of blocks) {
  const blk = await rpcRetry(() => client.getBlock({ blockNumber: BigInt(b) }))
  ts[b] = Number(blk.timestamp)
}

// 3. decode into activity entries
function words(data) {
  const d = (data || '').slice(2)
  return Array.from({ length: Math.floor(d.length / 64) }, (_, i) => d.slice(i * 64, (i + 1) * 64))
}
function topicAddr(t) {
  return '0x' + t.slice(-40).toLowerCase()
}

const events = logs.map(l => {
  const t0 = l.topics[0]
  const block = parseInt(l.blockNumber, 16)
  const base = {
    pool: topicAddr(l.topics[1]),
    tx: l.transactionHash,
    timestamp: ts[block] ?? 0,
    block,
  }
  if (t0 === T_ADD || t0 === T_REMOVE) {
    const w = words(l.data)
    // w0 totalSupply; w1/w2 array offsets; arrays follow
    const amountsOffset = Number(BigInt('0x' + w[1]))
    const amountsHead = Math.floor(amountsOffset / 32)
    const amountsLen = Number(BigInt('0x' + w[amountsHead]))
    const amounts = []
    for (let i = 0; i < amountsLen; i++) {
      amounts.push(BigInt('0x' + w[amountsHead + 1 + i]).toString())
    }
    return {
      ...base,
      type: t0 === T_ADD ? 'ADD' : 'REMOVE',
      userAddress: topicAddr(l.topics[2]),
      kind: Number(BigInt(l.topics[3])),
      totalSupply: BigInt('0x' + w[0]).toString(),
      amountsRaw: amounts,
    }
  }
  // Swap
  const w = words(l.data)
  return {
    ...base,
    type: 'SWAP',
    userAddress: topicAddr(l.topics[2]) === topicAddr(l.topics[1]) ? '0x' + '0'.repeat(40) : '0x' + '0'.repeat(40),
    tokenIn: topicAddr(l.topics[2]),
    tokenOut: topicAddr(l.topics[3]),
    amountInRaw: BigInt('0x' + w[0]).toString(),
    amountOutRaw: BigInt('0x' + w[1]).toString(),
  }
})

// 4. SWAP userAddress: the Swap event does not index the sender —
// fetch the transaction's from field for each swap (small, bounded set).
for (const e of events) {
  if (e.type !== 'SWAP') continue
  try {
    const tx = await rpcRetry(() => client.getTransaction({ hash: e.tx }))
    e.userAddress = (tx.from || '0x' + '0'.repeat(40)).toLowerCase()
  } catch {
    // keep zero-address — the tx link still identifies the action
  }
}

const out = {
  version: 1,
  chainId: config.chainId,
  generatedAt: new Date().toISOString(),
  fromBlock: config.from,
  cursor: latest,
  events,
}
const outFile = new URL('./' + config.output, import.meta.url).pathname
writeFileSync(outFile, JSON.stringify(out, null, 2))
console.log('wrote', config.output, '-', events.length, 'events')
