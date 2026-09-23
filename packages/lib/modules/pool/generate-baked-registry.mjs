// Rootstock: generates baked pool registry JSON from live onchain discovery.
// Run at freeze time (ARD-03): the registry is baked into the IPFS artifact.
// Usage: node generate-baked-registry.mjs
import { writeFileSync } from 'fs'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
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

const pools = await Promise.all(logs.map(async ({ pool, factory, block }) => {
  const entry = { address: pool, factory, blockNumber: block, type: FACTORY_TYPES[factory] || 'WEIGHTED' }
  try {
    const [name, symbol, tokens, totalSupply] = await Promise.all([
      client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'name' }),
      client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'symbol' }),
      client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'getTokens' }),
      client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'totalSupply' }),
    ])
    Object.assign(entry, { name, symbol, tokens, totalSupply: totalSupply.toString() })
  } catch { /* keep minimal entry */ }
  return entry
}))

const registry = {
  version: 1,
  chain: 'BASESEP',
  chainId: 84532,
  generatedAt: new Date().toISOString(),
  fromBlock: FROM,
  pools,
}
const out = new URL('./baked-pool-registry.json', import.meta.url).pathname
writeFileSync(out, JSON.stringify(registry, null, 2))
console.log('BAKED REGISTRY:', pools.length, 'pools ->', out)
