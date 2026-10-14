'use client'

import { VStack, Text, Grid, GridItem } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { useRef } from 'react'
import { FeatureCard } from './shared/FeatureCard'
import { WordsPullUp } from '@repo/lib/shared/components/animations/WordsPullUp'
import { FadeIn } from '@repo/lib/shared/components/animations/FadeIn'
import { motion, useInView } from 'motion/react'

const MotionGrid = motion(Grid)
const MotionGridItem = motion(GridItem)

const engineStats = [
  {
    stat: '1',
    title: 'Root Vault',
    subTitle: 'Every pool shares one core ledger',
  },
  {
    stat: '4',
    title: 'Pool families',
    subTitle: 'Weighted · stable · boosted · reCLAMM',
  },
  {
    stat: '2',
    title: 'Routers',
    subTitle: 'Router and BatchRouter entry points',
  },
  {
    stat: '65',
    title: 'Contracts live',
    subTitle: 'Deployed on Base Sepolia',
  },
]

export function Grow() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

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

  return (
    <Noise backgroundColor="background.level0WithOpacity">
      <DefaultPageContainer noVerticalPadding py={['3xl', '10rem']}>
        <VStack alignItems="center" spacing="md" textAlign="center">
          <WordsPullUp
            as="h2"
            color="font.primary"
            fontSize="4xl"
            fontWeight="bold"
            letterSpacing="-0.04rem"
            lineHeight={1}
            text="The engine today"
          />
          <FadeIn delay={0.2} direction="up" duration={0.6}>
            <Text color="font.secondary" fontSize="lg" maxW="2xl">
              The engine’s own deployment — live on testnet while it grows.
            </Text>
          </FadeIn>
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
          {engineStats.map(s => (
            <MotionGridItem key={s.title} variants={gridItemVariants}>
              <FeatureCard
                radialPatternProps={{
                  innerHeight: 100,
                  innerWidth: 100,
                  height: 200,
                  width: 200,
                  circleCount: 6,
                }}
                stat={s.stat}
                statProps={{ fontSize: '3xl', fontWeight: 'bold' }}
                subTitle={s.subTitle}
                title={s.title}
                titleSize="2xl"
              />
            </MotionGridItem>
          ))}
        </MotionGrid>
      </DefaultPageContainer>
    </Noise>
  )
}
