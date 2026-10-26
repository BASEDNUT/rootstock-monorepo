import { HStack, Text } from '@chakra-ui/react'
import { ExpandedPoolInfo } from '../../portfolio/PortfolioTable/useExpandedPools'
import { PoolDisplayType, PoolListItem } from '../pool.types'
import { PoolListPoolName } from './PoolListPoolName'
import { PoolListTokenPills } from './PoolListTokenPills'

/** Tickers view (2026-10-26): compact symbol pairs — 'NUT / cbBTC' — the
 * densest reading of a pool row. Falls back to the BPT symbol when token
 * symbols are unavailable (never fabricates). */
function PoolListPoolTickers({ pool }: { pool: PoolListItem | ExpandedPoolInfo }) {
  const symbols = (pool.poolTokens || [])
    .map(t => (t as { symbol?: string }).symbol)
    .filter(Boolean) as string[]

  const tickers = symbols.length > 0 ? symbols.join(' / ') : pool.symbol || ''

  return (
    <HStack alignItems="center" h={['32px', '36px']} my="0" p={['xxs', 'sm']} pr={[1.5, 'ms']}>
      <Text fontWeight="medium" noOfLines={1} textAlign="left">
        {tickers}
      </Text>
    </HStack>
  )
}

export function PoolListPoolDisplay({
  pool,
  name,
  poolDisplayType,
  isTokenInWallet,
}: {
  pool: PoolListItem | ExpandedPoolInfo
  name: string | undefined
  poolDisplayType: PoolDisplayType
  isTokenInWallet?: (tokenAddress: string) => boolean
}) {
  let component

  switch (poolDisplayType) {
    case PoolDisplayType.Name:
      component = <PoolListPoolName pool={pool} />
      break
    case PoolDisplayType.Tickers:
      component = <PoolListPoolTickers pool={pool} />
      break
    case PoolDisplayType.TokenPills:
    default:
      component = (
        <PoolListTokenPills
          h={['32px', '36px']}
          iconSize={name ? 24 : 20}
          isTokenInWallet={isTokenInWallet}
          nameSize="sm"
          p={['xxs', 'sm']}
          pool={pool}
          pr={[1.5, 'ms']}
        />
      )

      break
  }

  return component
}
