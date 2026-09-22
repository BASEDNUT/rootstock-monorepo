'use client'

import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack,
  Link,
  chakra,
  Stack,
  Center,
} from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'

import { useState, useEffect, useRef } from 'react'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { HookIcon } from '@repo/lib/shared/components/icons/HookIcon'
import { PieIcon } from '@repo/lib/shared/components/icons/PieIcon'
import { StarsIconPlain } from '@repo/lib/shared/components/icons/StarsIconPlain'
import { FeatureCard } from './shared/FeatureCard'
import { RadialPattern } from './shared/RadialPattern'
import { NutLogo } from '@bal/lib/components/imgs/NutLogo'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { FadeIn } from '@repo/lib/shared/components/animations/FadeIn'
import { WordsPullUp } from '@repo/lib/shared/components/animations/WordsPullUp'
import { motion, useInView } from 'motion/react'

const MotionBox = motion(Box)
const MotionGrid = motion(Grid)
const MotionGridItem = motion(GridItem)

const keyFeatures = [
  {
    title: 'Custom pools',
    subTitle: 'Build the market you want',
    description:
      'Pick weighted, stable, boosted, or write your own math. The pool holds only its curve — the vault handles the rest.',
    icon: <PieIcon size={40} />,
  },
  {
    title: 'Hooks',
    subTitle: 'Behavior at the edges',
    description:
      'Attach custom logic before and after any operation — dynamic fees, guards, custom accounting — without touching the core.',
    icon: <HookIcon size={70} />,
  },
  {
    title: 'Boosted pools',
    subTitle: 'Liquidity that stays busy',
    description:
      'Idle balances lend out through Aave and Morpho, so LPs earn market fees and lending yield at the same time.',
    icon: <StarsIconPlain size={32} />,
  },
]

const features = [
  {
    title: 'LVR/MEV Mitigation',
    shortDescription:
      'The engine focuses on minimizing MEV and maximizing LP profitability through custom pool logic and a hooks framework.',
    description:
      'MEV mitigation is a first-class design concern. Custom pool logic and the hooks framework let third-party teams develop MEV strategies that bolster fairness and profitability for LPs.',
    imageSrc: '/images/graphics/stone-2.png',
  },
  {
    title: 'Decimal Scaling',
    shortDescription:
      'Tokens arrive with different decimals. The vault normalizes every balance to 18, so pool math never trips on precision.',
    imageSrc: '/images/graphics/stone-1.png',
  },
  {
    title: 'Rate Scaling',
    shortDescription:
      'Rate-bearing tokens like LSTs change value on their own. The vault scales every rate into the balance, so pools price them correctly by default.',
    imageSrc: '/images/graphics/stone-2.png',
  },
  {
    title: 'Liquidity Invariant Approximation',
    shortDescription:
      'Add or remove liquidity in any ratio. The engine approximates the invariant, so users are never forced into proportional deposits.',
    imageSrc: '/images/graphics/stone-2.png',
  },
  {
    title: 'Transient Accounting',
    shortDescription:
      'EIP-1153 transient storage lets the vault enforce invariants inside a single callback — patterns that were impossible before.',
    imageSrc: '/images/graphics/stone-1.png',
  },
  {
    title: 'ERC20MultiToken',
    shortDescription:
      'One contract tracks every pool token balance and supply. Updates are atomic, closing read-only reentrancy vectors.',
    imageSrc: '/images/graphics/stone-1.png',
  },
  {
    title: 'Swap Fee Management',
    shortDescription:
      'The vault owns fee accounting. Every pool type gets the same interface, and hooks can still shape fees when needed.',
    imageSrc: '/images/graphics/stone-2.png',
  },
  {
    title: 'Pool Creator Fee',
    shortDescription:
      'Anyone who builds a pool can earn a share of its fees — permissionless, set at creation.',
    imageSrc: '/images/graphics/stone-2.png',
  },
  {
    title: 'Pool Pause Manager',
    shortDescription:
      'A pool declares its own pause window at registration. The vault enforces it — no trusted operator required.',
    imageSrc: '/images/graphics/stone-1.png',
  },
]

function FeatureText({
  title,
  shortDescription,
  description,
  index,
}: {
  title: string
  shortDescription: string
  description?: string
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isOdd = index % 2 === 1

  return (
    <VStack
      alignItems="start"
      position="relative"
      spacing="sm"
      {...(isOdd && { bg: 'background.level0' })}
      p="md"
      rounded="lg"
    >
      <Heading as="h5" size="md">
        {title}
      </Heading>
      <Box position="relative">
        <Text color="font.secondary" sx={{ textWrap: 'balance' }} whiteSpace="pre-line">
          {shortDescription}
          {description && (
            <Link ml="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? 'Show less' : 'Read more'}
            </Link>
          )}
        </Text>
        {isExpanded && (
          <MotionBox
            animate={{ opacity: 1 }}
            bg="background.level0"
            borderRadius="md"
            boxShadow="lg"
            initial={{ opacity: 0 }}
            left={-4}
            maxW="600px"
            p={4}
            position="absolute"
            top={-4}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <Text color="font.secondary" fontSize="lg" whiteSpace="pre-line">
              {description}
              <Link ml="sm" onClick={() => setIsExpanded(false)}>
                Show less
              </Link>
            </Text>
          </MotionBox>
        )}
      </Box>
    </VStack>
  )
}

export function Features() {
  const [scrollPercentage, setScrollPercentage] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isMobile } = useBreakpoints()

  const gridRef = useRef(null)
  const isInView = useInView(gridRef, { once: true, margin: '-50px' })

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

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const windowHeight = window.innerHeight

        // Add a buffer of 100px to delay the start of the animation
        const buffer = 300

        // Calculate progress with buffer
        const progress = Math.min(
          Math.max(((windowHeight - (rect.top + buffer)) / rect.height) * 100, 0),
          100
        )

        setScrollPercentage(progress)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <Noise position="relative">
      <DefaultPageContainer
        minH="800px"
        noVerticalPadding
        position="relative"
        pt={['xl', '3xl']}
        py={['3xl', '10rem']}
      >
        <FadeIn delay={0.2} direction="up" duration={0.6}>
          <Heading as="h4" mx="auto" size="lg">
            <chakra.span color="font.primary">Built for builders.</chakra.span>
            <chakra.span color="font.primary" style={{ opacity: 0.6 }}>
              {' '}
              Core mechanics come standard — your market ships with only its own math.
            </chakra.span>
          </Heading>
        </FadeIn>

        <MotionGrid
          animate={isInView ? 'show' : 'hidden'}
          gap="xl"
          initial="hidden"
          mt="2xl"
          ref={gridRef}
          templateColumns={{ base: 'repeat(1, 1fr)', lg: 'repeat(3, 1fr)' }}
          variants={gridVariants}
        >
          {keyFeatures.map((feature, index) => (
            <MotionGridItem key={index} variants={gridItemVariants}>
              <FeatureCard {...feature} iconProps={{ color: 'font.primary' }} />
            </MotionGridItem>
          ))}
        </MotionGrid>

        <Stack direction={{ base: 'column', lg: 'row' }} gap="2xl" mt="3xl">
          <Box
            alignSelf="flex-start"
            h={isMobile ? 'auto' : '700px'}
            position="sticky"
            top="82px"
            w="full"
          >
            <VStack alignItems="start" spacing="lg">
              <WordsPullUp
                as="h2"
                color="font.primary"
                fontSize="4xl"
                fontWeight="bold"
                letterSpacing="-0.04rem"
                lineHeight={1}
                text="Technical highlights"
              />
              <FadeIn delay={0.2} direction="up" duration={0.6}>
                <Text color="font.secondary" fontSize="lg" sx={{ textWrap: 'pretty' }}>
                  The engine ships a set of technical choices that simplify
                  development and building custom pools, without giving up the flexibility the system is built on.
                </Text>
              </FadeIn>
            </VStack>
            {!isMobile && (
              <Center position="relative">
                <RadialPattern
                  circleCount={8}
                  height={600}
                  innerHeight={150}
                  innerWidth={150}
                  position="absolute"
                  progress={scrollPercentage}
                  top={-10}
                  width={600}
                >
                  <NutLogo width="100" />
                </RadialPattern>
              </Center>
            )}
          </Box>
          <VStack ref={containerRef} spacing="md" w="full">
            {features.map((feature, index) => (
              <FadeIn direction="up" key={index} zIndex={10 - index}>
                <FeatureText index={index} {...feature} />
              </FadeIn>
            ))}
          </VStack>
        </Stack>
      </DefaultPageContainer>

      <Box
        bgGradient="linear(transparent 0%, background.base 50%, transparent 100%)"
        bottom="0"
        h="200px"
        left="0"
        mb="-100px"
        position="absolute"
        w="full"
      />
    </Noise>
  )
}
