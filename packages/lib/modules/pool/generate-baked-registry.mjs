// Rootstock: generates baked pool registry JSON from live onchain discovery.
// Run at freeze time (ARD-03): the registry is baked into the IPFS artifact.
// Usage: node generate-baked-registry.mjs
import { writeFileSync } from 'fs'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { erc20Abi } from 'viem'
import { weightedPoolAbi_V3 } from '@balancer/sdk'

const VAULT = '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9'
const TOPIC0 = '0xbc1561eeab9f40962e2fb827a7ff9c7cdb47a9d7c84caeefa4ed90e043842dad'
const RPC = 'https://sepolia.base.org'
const FROM = 46_984_000
const CHUNK = 1_000

const FACTORY_TYPES = {
  '0x277d7dde3c6762c31cfb438c9331376fe8887a7c': 'WEIGHTED',
  '0x24ab9fba48e54b05c24a02122c4c40fd2018ba10': 'STABLE',
  '0x6cd1150ccc00e0d00cd3f671a8bdf00d38f5be6e': 'STABLE',
  '0x458d984f6216daffc9da4577fc949bcab0e52b6d': 'GYRO',
  '0x6057859cc86aa62c54860e1a342f60ab42098efe': 'GYROE',
  '0x928e433f50fa579c9be5f7e1273f1db46d630ee1': 'RECLAMM',
  '0xdfdddd87dc49756dd93598123879ae3d67b531a3': 'LIQUIDITY_BOOTSTRAPPING',
  '0x9a30757385012495a21d64c5efac335b1a6fe48d': 'LIQUIDITY_BOOTSTRAPPING',
}

const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) })

// S100b F6 fix: parallel reads across 9 pools × ~10 calls throttled
// sepolia.base.org — 7 pools regressed to minimal entries (no tokens).
// Retry with backoff + sequential pool processing instead of one burst.
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

const latest = await client.getBlockNumber()
const logs = []
for (let to = latest; to > BigInt(FROM); to -= BigInt(CHUNK)) {
  const from = to - BigInt(CHUNK) >= BigInt(FROM) ? to - BigInt(CHUNK) : BigInt(FROM)
  const raw = await client.request({
    method: 'eth_getLogs',
    params: [{ address: VAULT, topics: [TOPIC0], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }],
  })
  for (const l of raw) logs.push({ pool: '0x' + l.topics[1].slice(-40), factory: '0x' + l.topics[2].slice(-40), block: parseInt(l.blockNumber, 16) })
}

// Sequential pool processing — no parallel RPC bursts (F6 regen lesson)
const pools = []
for (const { pool, factory, block } of logs) {
  const entry = { address: pool, factory, blockNumber: block, type: FACTORY_TYPES[factory] || 'WEIGHTED' }
  try {
    const [name, symbol, tokens, totalSupply, staticSwapFee, blockData] = await Promise.all([
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'name' }),
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'symbol' }),
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'getTokens' }),
      readRetry({ address: pool, abi: weightedPoolAbi_V3, functionName: 'totalSupply' }),
      readRetry({
        address: pool,
        abi: [{ name: 'getStaticSwapFeePercentage', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
        functionName: 'getStaticSwapFeePercentage',
      }),
      client.getBlock({ blockNumber: BigInt(block) }).catch(() => null),
    ])
    // S101 (D1/D3 fix): bake blockTimestamp (unix seconds, real creation
    // time — blockNumber is NOT a timestamp; UI multiplied it by 1000ms and
    // rendered '01 July 1971') and swapFee as a decimal-fraction string
    // ('0.003' = 0.3%), matching upstream GqlPool dynamicData.swapFee format.
    const blockTimestamp = blockData ? Number(blockData.timestamp) : undefined
    const swapFee =
      staticSwapFee !== undefined && staticSwapFee !== null
        ? String(Number(staticSwapFee) / 1e18)
        : undefined
    Object.assign(entry, { blockTimestamp, swapFee })
    // S100b audit fix F6: bake ERC20 token metadata (symbol/name/decimals) so
    // pool list pills + detail pages render token symbols, not icon-only.
    const tokenMeta = []
    for (const address of tokens) {
      try {
        const [tSymbol, tName, tDecimals] = await Promise.all([
          readRetry({ address, abi: erc20Abi, functionName: 'symbol' }),
          readRetry({ address, abi: erc20Abi, functionName: 'name' }),
          readRetry({ address, abi: erc20Abi, functionName: 'decimals' }),
        ])
        tokenMeta.push({ address, symbol: tSymbol, name: tName, decimals: tDecimals })
      } catch {
        // WETH-style contracts or non-ERC20 — keep address-only entry
        tokenMeta.push({ address })
      }
    }
    Object.assign(entry, { name, symbol, tokens: tokenMeta, totalSupply: totalSupply.toString() })
  } catch { /* keep minimal entry */ }
  pools.push(entry)
}

const registry = {
  version: 1,
  chain: 'BASESEP',
  chainId: 84532,
  generatedAt: new Date().toISOString(),
  fromBlock: FROM,
  // S100b Boss law (2026-09-24): mock-named pools ('DO NOT USE - Mock ...'
  // from Phase-1 E2E battery) NEVER bake into the artifact — no list rows,
  // no static detail pages, no deep links. Only real named pools bake.
  pools: pools.filter(p => !/do\s*not\s*use/i.test(p.name || '') && !/do\s*not\s*use/i.test(p.symbol || '')),
}
const out = new URL('./baked-pool-registry.json', import.meta.url).pathname
writeFileSync(out, JSON.stringify(registry, null, 2))
console.log('BAKED REGISTRY:', pools.length, 'pools ->', out)
