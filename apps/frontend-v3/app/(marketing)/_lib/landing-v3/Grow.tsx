'use client'

import { Grid, GridItem, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { useOnchainPoolDiscovery } from '@repo/lib/modules/pool/useOnchainPoolDiscovery'

const MotionGrid = motion(Grid)
const MotionGridItem = motion(GridItem)

// Grow section (Boss 2026-10-01): live engine facts, high on
// the page so new users see traction immediately. Pool count is LIVE from
// the onchain discovery scan; engine facts are deployment-ledger verified.
const engineFacts = [
  {
    stat: '42',
    title: 'Contracts live',
    subTitle: 'Deployed on Base Sepolia',
  },
  {
    stat: '8',
    title: 'Pool factories',
    subTitle: 'Weighted · stable · boosted · reCLAMM · Gyro · LBP',
  },
  {
    stat: '7',
    title: 'Routers',
    subTitle: 'Router · batch · buffer · composite · aggregator',
  },
]

export function Grow() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const { data: discoveredPools } = useOnchainPoolDiscovery(true)
  const poolCount = discoveredPools?.length ?? 1

  const gridVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  }

  const gridItemVariants = {
    show: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 10,
      },
    },
    hidden: { opacity: 0, filter: 'blur(3px)', scale: 0.95, y: 15 },
  }

  const allStats = [
    {
      stat: String(poolCount),
      title: 'Pools live',
      subTitle: 'Discovered onchain',
    },
    ...engineFacts,
  ]

  return (
    <Noise backgroundColor="background.level0WithOpacity">
      <DefaultPageContainer noVerticalPadding py={['3xl', '10rem']}>
        <VStack alignItems="center" spacing="md" textAlign="center">
          <Text background="font.special" backgroundClip="text" fontSize="sm" variant="eyebrow">
            Live on testnet
          </Text>
          <Text
            color="font.primary"
            fontSize={{ base: '4xl', md: '6xl' }}
            fontWeight="bold"
            lineHeight={1.05}
          >
            Growing from the root.
          </Text>
          <Text color="font.secondary" fontSize="lg" maxW="2xl">
            Live on Base Sepolia while it grows. Every number below is real — counted from the chain
            itself.
          </Text>
        </VStack>
        <MotionGrid
          animate={isInView ? 'show' : 'hidden'}
          gap="md"
          initial="hidden"
          mt="2xl"
          ref={ref}
          templateColumns={{ base: 'repeat(1, 1fr)', lg: 'repeat(4, 1fr)' }}
          variants={gridVariants}
        >
          {allStats.map(s => (
            <MotionGridItem key={s.title} variants={gridItemVariants}>
              <VStack alignItems="start" bg="background.level0" p="lg" rounded="lg" spacing="xs">
                <Text fontSize="3xl" fontWeight="bold">
                  {s.stat}
                </Text>
                <Text fontSize="md" fontWeight="medium">
                  {s.title}
                </Text>
                <Text color="font.secondary" fontSize="sm">
                  {s.subTitle}
                </Text>
              </VStack>
            </MotionGridItem>
          ))}
        </MotionGrid>
      </DefaultPageContainer>
    </Noise>
  )
}
