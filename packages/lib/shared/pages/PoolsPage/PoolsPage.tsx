'use client'

import { PoolList } from '@repo/lib/modules/pool/PoolList/PoolList'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import { Box, Skeleton, Flex, Heading, Text } from '@chakra-ui/react'
import { PropsWithChildren, Suspense } from 'react'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { RadialPattern } from '@repo/lib/shared/components/zen/RadialPattern'
import { PoolPageStats } from './PoolPageStats'
import { NewPools } from './NewPools'
import { PROJECT_CONFIG, isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { fNumCustom } from '../../utils/numbers'
import { useProtocolStats } from '@repo/lib/modules/protocol/ProtocolStatsProvider'
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs'
import { isBalancer } from '@repo/lib/config/getProjectConfig'
import { BuildPromo } from './BuildPromo'

// Rootstock S100: mirrors the pool-list networks parser so the hero/stats
// section knows which networks the user selected (source of truth = URL).
const networksParser = parseAsArrayOf(parseAsString).withDefault([])

type PoolsPageProps = PropsWithChildren & {
  rewardsClaimed24h?: string
}

export function PoolsPage({ children, rewardsClaimed24h }: PoolsPageProps) {
  const { supportedNetworks } = PROJECT_CONFIG

  // Rootstock S100: when every selected network is onchain-only (BASESEP),
  // the hero stats + LP copy are upstream-API data and MUST NOT render —
  // they would misrepresent ROOTSTOCK with liquidity that is not ours.
  // Verified live: BASESEP view showed upstream '$1.7m TVL / 11k+ LPs'.
  const [networks] = useQueryState('networks', networksParser)
  const selectedNetworks = (networks.length > 0 ? networks : supportedNetworks) as never[]
  const allOnchainOnly = selectedNetworks.every(isOnchainOnlyNetwork)

  const { protocolData } = useProtocolStats()

  return (
    <>
      <Box borderBottom="1px solid" borderColor="border.base">
        <Noise
          backgroundColor="background.level0WithOpacity"
          overflow="hidden"
          position="relative"
          shadow="innerBase"
        >
          <DefaultPageContainer
            pb={['xl', 'xl', '10']}
            pr={{ base: '0 !important', md: 'md !important' }}
            pt={['xl', '40px']}
          >
            <Box display={{ base: 'none', md: 'block' }}>
              <RadialPattern
                circleCount={8}
                height={600}
                innerHeight={150}
                innerWidth={500}
                padding="15px"
                position="absolute"
                right={{ base: -800, lg: -700, xl: -600, '2xl': -400 }}
                top="40px"
                width={1000}
              />
              <RadialPattern
                circleCount={8}
                height={600}
                innerHeight={150}
                innerWidth={500}
                left={{ base: -800, lg: -700, xl: -600, '2xl': -400 }}
                padding="15px"
                position="absolute"
                top="40px"
                width={1000}
              />
            </Box>
            <RadialPattern
              circleCount={8}
              height={600}
              innerHeight={150}
              innerWidth={150}
              left="calc(50% - 300px)"
              position="absolute"
              top="-300px"
              width={600}
            />
            <RadialPattern
              circleCount={8}
              height={600}
              innerHeight={150}
              innerWidth={150}
              left="calc(50% - 300px)"
              position="absolute"
              top="300px"
              width={600}
            />
            <FadeInOnView animateOnce={false}>
              <Flex
                align={{ base: 'start', md: 'start' }}
                direction={{ base: 'column', lg: 'row' }}
                gap="4"
                justify={{ base: 'start', md: 'space-between' }}
                mb="10"
              >
                <Box>
                  <Heading pb="3" sx={{ textWrap: 'balance' }} variant="special">
                    Earn passively on {PROJECT_CONFIG.projectName}
                  </Heading>
                  <Text sx={{ textWrap: 'balance' }} variant="secondary">
                    {allOnchainOnly
                      ? 'Liquidity lives onchain — pool data read directly from the network'
                      : `Join ${fNumCustom(protocolData?.protocolMetricsAggregated.numLiquidityProviders || '0', '0a')}+ Liquidity Providers in yield-bearing pools`}
                  </Text>
                </Box>
                {!allOnchainOnly && <PoolPageStats rewardsClaimed24h={rewardsClaimed24h} />}
              </Flex>
            </FadeInOnView>
            <FadeInOnView animateOnce={false}>
              <Box pb={{ base: '0', md: '3' }}>{children}</Box>
            </FadeInOnView>
          </DefaultPageContainer>
        </Noise>
      </Box>
      <DefaultPageContainer
        noVerticalPadding
        pb="xl"
        pr={{ base: '0 !important', xl: 'md !important' }}
        pt={['lg', '54px']}
      >
        <FadeInOnView animateOnce={false}>
          <Suspense fallback={<Skeleton h="500px" w="full" />}>
            <PoolList />
          </Suspense>
        </FadeInOnView>
      </DefaultPageContainer>
      <DefaultPageContainer mb="0" py="0" rounded="2xl">
        <NewPools />
      </DefaultPageContainer>
      {isBalancer && (
        <DefaultPageContainer mb="0" py="0" rounded="2xl">
          <BuildPromo />
        </DefaultPageContainer>
      )}
    </>
  )
}
