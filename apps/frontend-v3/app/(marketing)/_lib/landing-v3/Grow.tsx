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

const designChoices = [
  {
    stat: '01',
    title: 'One ledger',
    subTitle: 'Every pool settles against the same vault — one place to audit.',
  },
  {
    stat: '02',
    title: 'Math you can read',
    subTitle: 'A pool is only its math — small contracts, no engine fork.',
  },
  {
    stat: '03',
    title: 'Hooks at the edges',
    subTitle: 'Custom behavior attaches without touching the core.',
  },
  {
    stat: '04',
    title: 'Routers up front',
    subTitle: 'One entry point for swaps, adds, removes, and solvers.',
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
            text="Designed as one piece"
          />
          <FadeIn delay={0.2} direction="up" duration={0.6}>
            <Text color="font.secondary" fontSize="lg" maxW="2xl">
              Four design choices keep the whole engine simple.
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
          {designChoices.map(s => (
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
