/* global setTimeout, URL, console, process */
// Rootstock: generates baked pool registry JSON from live onchain discovery.
// Run at freeze time (ARD-03): the registry is baked into the IPFS artifact.
// Usage: node generate-baked-registry.mjs [--chain base-sepolia|base]
// Parameterized per chain — Base Sepolia keeps the existing
// consts (output baked-pool-registry.json); Base mainnet scans OUR vault
// (0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7) via base.publicnode.com from
// block 52_131_550 (8453 scan config, onchain-pool-discovery.ts) and writes
// baked-pool-registry-base.json. Mock-name filter law unchanged.
import { readFileSync, writeFileSync } from 'fs'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { erc20Abi } from 'viem'
import { vaultExtensionAbi_V3, weightedPoolAbi_V3 } from '@balancer/sdk'

const TOPIC0 = '0xbc1561eeab9f40962e2fb827a7ff9c7cdb47a9d7c84caeefa4ed90e043842dad'

// Factory -> pool type, per chain (addresses from LIVE_DEPLOYMENTS.md;
// the same 8453 block as FACTORY_TO_POOL_TYPE in onchain-pool-discovery.ts).
const FACTORY_TYPES_BY_CHAIN = {
  'base-sepolia': {
    '0x277d7dde3c6762c31cfb438c9331376fe8887a7c': 'WEIGHTED',
    '0x24ab9fba48e54b05c24a02122c4c40fd2018ba10': 'STABLE',
    '0x6cd1150ccc00e0d00cd3f671a8bdf00d38f5be6e': 'STABLE',
    '0x458d984f6216daffc9da4577fc949bcab0e52b6d': 'GYRO',
    '0x6057859cc86aa62c54860e1a342f60ab42098efe': 'GYROE',
    '0x928e433f50fa579c9be5f7e1273f1db46d630ee1': 'RECLAMM',
    '0xdfdddd87dc49756dd93598123879ae3d67b531a3': 'LIQUIDITY_BOOTSTRAPPING',
    '0x9a30757385012495a21d64c5efac335b1a6fe48d': 'LIQUIDITY_BOOTSTRAPPING',
  },
  base: {
    '0x9a5bd368c8da0d7fad33fc89b6be4e39e5a33f92': 'WEIGHTED',
    '0x74c9804b4659feb7d056f150a810c4b5ae926da1': 'STABLE',
    '0x179bdcaebadf57d6be08db5776781f4d0b64d5ce': 'STABLE',
    '0x8da17c9a51b3bbc4a4c951edce5cd9764e42a985': 'GYRO',
    '0xf7024eb7d37e993c8959090c84762f6273e43682': 'GYROE',
    '0x730bf6af759e9e74aa6f9f0950e233df974d1859': 'RECLAMM',
    '0xf5cac7d8e637d2827c07c44ae4767093647b0867': 'LIQUIDITY_BOOTSTRAPPING',
    '0x5dbd872f506ab714bf4d9c20675598d9f1495ba8': 'LIQUIDITY_BOOTSTRAPPING',
  },
}

const CHAIN_CONFIGS = {
  'base-sepolia': {
    chain: 'BASESEP',
    chainId: 84532,
    vault: '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9',
    rpc: 'https://sepolia.base.org',
    viemChain: baseSepolia,
    from: 46_984_000,
    chunk: 1_000,
    output: 'baked-pool-registry.json',
  },
  base: {
    chain: 'BASE',
    chainId: 8453,
    vault: '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
    // publicnode archive getLogs is token-gated; the Tenderly public
    // gateway serves 1000-block archive ranges.
    rpc: 'https://base.gateway.tenderly.co',
    viemChain: base,
    from: 52_131_550,
    chunk: 1_000,
    output: 'baked-pool-registry-base.json',
  },
}

const chainArg = process.argv.includes('--chain')
  ? process.argv[process.argv.indexOf('--chain') + 1]
  : 'base-sepolia'
const config = CHAIN_CONFIGS[chainArg]
if (!config) {
  console.error('Unknown chain:', chainArg, '- use --chain base-sepolia|base')
  process.exit(1)
}
const FACTORY_TYPES = FACTORY_TYPES_BY_CHAIN[chainArg]

const client = createPublicClient({ chain: config.viemChain, transport: http(config.rpc) })

//  F6 fix: parallel reads across pools throttled public RPCs —
// retry with backoff + sequential pool processing instead of one burst.
async function readRetry(args, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      return await client.readContract(args)
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise(r => setTimeout(r, 1500 * (i + 1)))
    }
  }
}

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

const latest = await client.getBlockNumber()
const logs = []
for (let to = latest; to > BigInt(config.from); to -= BigInt(config.chunk)) {
  const from =
    to - BigInt(config.chunk) >= BigInt(config.from)
      ? to - BigInt(config.chunk)
      : BigInt(config.from)
  const raw = await rpcRetry(() =>
    client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: config.vault,
          topics: [TOPIC0],
          fromBlock: '0x' + from.toString(16),
          toBlock: '0x' + to.toString(16),
        },
      ],
    })
  )
  for (const l of raw)
    logs.push({
      pool: '0x' + l.topics[1].slice(-40),
      factory: '0x' + l.topics[2].slice(-40),
      block: parseInt(l.blockNumber, 16),
    })
}

// Sequential pool processing — no parallel RPC bursts (F6 regen lesson).
// 2026-10-26 fast-bake: (1) mock-name gate runs after ONE cheap read pair —
// the 9 Phase-1 mock fixtures skip the expensive holder Transfer scan
// entirely; (2) pools already baked in the existing registry keep every
// stored field (holdersCount, tokens, blockTimestamp, swapFee) and only
// gain the v2 display facts — the holder scan (~400 chunks/pool for the
// Phase-1 era) is the slow path and its output is unchanged for old pools;
// (3) full path only for NEW pools (small scan windows).
const outPath = new URL('./' + config.output, import.meta.url).pathname
const existingByAddress = new Map()
try {
  const prev = JSON.parse(readFileSync(outPath, 'utf8'))
  for (const p of prev.pools || []) existingByAddress.set(p.address.toLowerCase(), p)
} catch {
  // no prior registry — every pool takes the full path
}

const mockName = s => (typeof s === 'string' && /do\s*not\s*use/i.test(s)) || false

// v2 display facts — same derive law as the live scan
// (onchain-pool-discovery.ts derivePoolDisplayFacts), inlined here because
// the bake generator is a standalone .mjs (no @repo imports).
async function readDisplayFacts(poolAddr) {
  try {
    const [hooksConfig, poolTokenInfo] = await Promise.all([
      readRetry({
        address: config.vault,
        abi: vaultExtensionAbi_V3,
        functionName: 'getHooksConfig',
        args: [poolAddr],
      }),
      readRetry({
        address: config.vault,
        abi: vaultExtensionAbi_V3,
        functionName: 'getPoolTokenInfo',
        args: [poolAddr],
      }),
    ])
    const hookAddr = String(hooksConfig.hooksContract || '').toLowerCase()
    const poolLower = poolAddr.toLowerCase()
    const isZero = hookAddr === '0x' + '0'.repeat(40)
    const isSelf = hookAddr === poolLower
    // viem returns getPoolTokenInfo as a POSITIONAL array
    // [tokens, tokenInfo, balancesRaw, lastBalancesLiveScaled18] — index 1.
    const tokenInfo = Array.isArray(poolTokenInfo) ? poolTokenInfo[1] : poolTokenInfo.tokenInfo
    const tokenTypes = (tokenInfo || []).map(t => Number(t.tokenType))
    const tags = []
    if (tokenTypes.some(t => t !== 0)) tags.push('BOOSTED')
    return { hook: !isZero && !isSelf ? hooksConfig.hooksContract : null, tags }
  } catch (e) {
    console.error('[facts] ' + poolAddr + ' unreadable:', e?.message?.slice(0, 120))
    return {}
  }
}

const pools = []
for (const { pool, factory, block } of logs) {
  // mock gate FIRST — one cheap read pair, then stop
  let name, symbol
  try {
    ;[name, symbol] = await Promise.all([
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'name' }),
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'symbol' }),
    ])
  } catch {
    // unreadable — full path keeps the legacy minimal-entry behavior
  }
  if (mockName(name) || mockName(symbol)) continue

  const prev = existingByAddress.get(pool.toLowerCase())
  if (prev) {
    // already baked — keep every stored field, refresh v2 facts only
    const facts = await readDisplayFacts(pool)
    pools.push({ ...prev, name, symbol, factory, blockNumber: block, ...facts })
    continue
  }

  const entry = {
    address: pool,
    factory,
    blockNumber: block,
    type: FACTORY_TYPES[factory.toLowerCase()] || 'UNKNOWN',
  }
  try {
    const [tokens, totalSupply, staticSwapFee, blockData] = await Promise.all([
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'getTokens' }),
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'totalSupply' }),
      readRetry({
        address: pool,
        abi: [
          {
            name: 'getStaticSwapFeePercentage',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'getStaticSwapFeePercentage',
      }),
      client.getBlock({ blockNumber: BigInt(block) }).catch(() => null),
    ])
    const blockTimestamp = blockData ? Number(blockData.timestamp) : undefined
    const swapFee =
      staticSwapFee !== undefined && staticSwapFee !== null
        ? String(Number(staticSwapFee) / 1e18)
        : undefined
    let holdersCount
    try {
      const T0_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const transferLogs = []
      for (let to = latest; to > BigInt(block); to -= BigInt(config.chunk)) {
        const from =
          to - BigInt(config.chunk) >= BigInt(block) ? to - BigInt(config.chunk) : BigInt(block)
        const raw =
          (await rpcRetry(() =>
            client.request({
              method: 'eth_getLogs',
              params: [
                {
                  address: pool,
                  topics: [T0_TRANSFER],
                  fromBlock: '0x' + from.toString(16),
                  toBlock: '0x' + to.toString(16),
                },
              ],
            })
          )) || []
        transferLogs.push(...raw)
      }
      const ZERO_ADDR = '0x' + '0'.repeat(40)
      const seenAddresses = new Set()
      for (const l of transferLogs) {
        const from = '0x' + l.topics[1].slice(-40).toLowerCase()
        const to = '0x' + l.topics[2].slice(-40).toLowerCase()
        if (from !== ZERO_ADDR) seenAddresses.add(from)
        if (to !== ZERO_ADDR) seenAddresses.add(to)
      }
      const balanceOfAbi = [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ type: 'address' }],
          outputs: [{ type: 'uint256' }],
        },
      ]
      let holders = 0
      for (const addr of seenAddresses) {
        try {
          const bal = await readRetry({
            address: pool,
            abi: balanceOfAbi,
            functionName: 'balanceOf',
            args: [addr],
          })
          if (bal > 0n) holders += 1
        } catch {
          // skip unverifiable address
        }
      }
      holdersCount = holders
    } catch (e) {
      console.error('[holders] ' + pool + ' scan failed:', e?.message?.slice(0, 200))
      holdersCount = undefined
    }
    const facts = await readDisplayFacts(pool)
    Object.assign(entry, { name, symbol, blockTimestamp, swapFee, holdersCount, ...facts })
    const tokenMeta = []
    for (const address of tokens) {
      try {
        const [tSymbol, tName, tDecimals] = await Promise.all([
          readRetry({ address, abi: erc20Abi, functionName: 'symbol' }),
          readRetry({ address, abi: erc20Abi, functionName: 'name' }),
          readRetry({ address, abi: erc20Abi, functionName: 'decimals' }),
        ])
        tokenMeta.push({ address, symbol: tSymbol, name: tName, decimals: tDecimals })
      } catch (e) {
        console.error('[tokenMeta] ' + address + ' unreadable:', e?.message?.slice(0, 120))
        tokenMeta.push({ address })
      }
    }
    Object.assign(entry, { tokens: tokenMeta, totalSupply: totalSupply.toString() })
  } catch {
    /* keep minimal entry */
  }
  pools.push(entry)
}

const registry = {
  version: 1,
  chain: config.chain,
  chainId: config.chainId,
  generatedAt: new Date().toISOString(),
  fromBlock: config.from,
  // Mock-named pools NEVER bake into the artifact — no list rows, no
  // static detail pages, no deep links.
  pools: pools.filter(
    p => !/do\s*not\s*use/i.test(p.name || '') && !/do\s*not\s*use/i.test(p.symbol || '')
  ),
}
const out = new URL('./' + config.output, import.meta.url).pathname
writeFileSync(out, JSON.stringify(registry, null, 2))
console.log(
  'BAKED REGISTRY [' + chainArg + ']:',
  logs.length,
  'pools found,',
  registry.pools.length,
  'displayed (mock-filtered) ->',
  out
)
