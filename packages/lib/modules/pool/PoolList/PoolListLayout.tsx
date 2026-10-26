'use client'

import { Box, Heading, Stack, HStack, Text, VStack, useBreakpointValue } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { FilterTags, PoolListFilters, useFilterTagsVisible } from './PoolListFilters'
import { PoolListTable } from './PoolListTable/PoolListTable'
import { usePoolList } from './PoolListProvider'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { ErrorBoundary } from 'react-error-boundary'
import { BoundaryError } from '@repo/lib/shared/components/errors/ErrorBoundary'
import { poolTypeLabel } from '../pool.helpers'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'

/** Rootstock (2026-10-26): global stats band on top of the table —
 * cumulative TVL / 24h volume / 24h fees / pool count, summed from the SAME
 * list the table renders. Unavailable metrics render '—' (never 0). */
function PoolListStatsBand() {
  const { aggregateStats } = usePoolList()
  const { toCurrency } = useCurrency()

  const stats = [
    { label: 'TVL', value: aggregateStats.totalLiquidity },
    { label: 'Volume (24h)', value: aggregateStats.volume24h },
    { label: 'Fees (24h)', value: aggregateStats.fees24h },
  ]

  return (
    <HStack
      bg="background.level1"
      border="1px solid"
      borderColor="border.base"
      gap="ms"
      p="md"
      rounded="2xl"
      shadow="md"
      w="full"
      wrap="wrap"
    >
      {stats.map(stat => (
        <VStack alignItems="start" flex={1} gap="0" key={stat.label} minW="110px">
          <Text color="font.secondary" size="sm" variant="secondary">
            {stat.label}
          </Text>
          <Text fontWeight="semibold">{stat.value == null ? '—' : toCurrency(stat.value)}</Text>
        </VStack>
      ))}
      <VStack alignItems="start" flex={1} gap="0" key="pools" minW="110px">
        <Text color="font.secondary" size="sm" variant="secondary">
          Pools
        </Text>
        <Text fontWeight="semibold">{fNum('integer', aggregateStats.poolCount)}</Text>
      </VStack>
    </HStack>
  )
}

export function PoolListLayout() {
  const {
    pools,
    loading,
    count,
    queryState: {
      networks,
      toggleNetwork,
      poolTypes,
      togglePoolType,
      minTvl,
      setMinTvl,
      poolTags,
      togglePoolTag,
      poolTagLabel,
      poolHookTags,
      togglePoolHookTag,
      poolHookTagLabel,
      joinablePools,
      toggleJoinablePools,
      protocolVersion,
      setProtocolVersion,
    },
  } = usePoolList()

  const isFilterVisible = useFilterTagsVisible()
  const isMd = useBreakpointValue({ base: false, md: true })

  const variants = {
    visible: {
      transform: isMd ? 'translateY(-40px)' : 'translateY(0)',
    },
    hidden: {
      transform: 'translateY(0)',
    },
  }

  return (
    <VStack align="start" minHeight="1000px" spacing="md" w="full">
      <Stack
        alignItems={isFilterVisible ? 'flex-end' : 'flex-start'}
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        w="full"
      >
        <VStack align="start" flex={1} pb={{ base: 'sm', md: '0' }} w="full">
          <HStack w="full">
            <Box position="relative" top="0">
              <Box
                animate={isFilterVisible ? 'visible' : 'hidden'}
                as={motion.div}
                left="0"
                minW={{ base: 'auto', md: '270px' }}
                position={{ base: 'relative', md: 'absolute' }}
                top="0"
                transition="all 0.15s var(--ease-out-cubic)"
                variants={variants}
                willChange="transform"
              >
                <HStack w="full">
                  <Heading as="h2" size="lg" variant="special">
                    Liquidity pools
                  </Heading>
                  <Heading mt="1" size="md" variant="secondary">
                    ({fNum('integer', count || 0)})
                  </Heading>
                </HStack>
              </Box>
            </Box>
          </HStack>
          <FilterTags
            joinablePools={joinablePools}
            minTvl={minTvl}
            networks={networks}
            poolHookTagLabel={poolHookTagLabel}
            poolHookTags={poolHookTags}
            poolTagLabel={poolTagLabel}
            poolTags={poolTags}
            poolTypeLabel={poolTypeLabel}
            poolTypes={poolTypes}
            protocolVersion={protocolVersion}
            setMinTvl={setMinTvl}
            setProtocolVersion={setProtocolVersion}
            toggleJoinablePools={toggleJoinablePools}
            toggleNetwork={toggleNetwork}
            togglePoolHookTag={togglePoolHookTag}
            togglePoolTag={togglePoolTag}
            togglePoolType={togglePoolType}
          />
        </VStack>

        <Stack
          align={{ base: 'end', sm: 'center' }}
          direction="row"
          w={{ base: 'full', md: 'auto' }}
        >
          <PoolListFilters />
        </Stack>
      </Stack>
      <PoolListStatsBand />
      <ErrorBoundary FallbackComponent={BoundaryError}>
        <PoolListTable count={count || 0} loading={loading} pools={pools} />
      </ErrorBoundary>
    </VStack>
  )
}
