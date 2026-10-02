'use client'

import { Box, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { WordsPullUp } from '@repo/lib/shared/components/animations/WordsPullUp'
import { FadeIn } from '@repo/lib/shared/components/animations/FadeIn'
import { RadialPattern } from './shared/RadialPattern'

// Section 1 — Code Stack (approved copy, Boss 2026-10-01).
// Architectural positioning: shared foundation in the core, market logic in
// pools, hooks, and modules. Orbital ring echo on the right ties the hero
// artwork motif through the page.
export function CodeStack() {
  return (
    <Noise position="relative">
      <DefaultPageContainer noVerticalPadding position="relative" py={['3xl', '10rem']}>
        <Box
          bottom={0}
          h="700px"
          left={0}
          opacity={0.25}
          position="absolute"
          right={-200}
          top="2rem"
          w={{ base: '80vw', lg: '45vw' }}
        >
          <RadialPattern
            circleCount={8}
            height={700}
            innerHeight={150}
            innerWidth={500}
            left={-400}
            padding="15px"
            position="absolute"
            top={0}
            width={1000}
          />
        </Box>
        <VStack alignItems="start" maxW="820px" position="relative" spacing="xl">
          <WordsPullUp
            as="h2"
            color="font.primary"
            flexWrap="wrap"
            fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }}
            fontWeight="bold"
            letterSpacing="-0.04rem"
            lineHeight={1.05}
            maxW="820px"
            pr="2"
            text="Build the market, not the machinery."
          />
          <FadeIn delay={0.2} direction="up" duration={0.6}>
            <Text color="font.secondary" fontSize="lg" maxW="700px" sx={{ textWrap: 'pretty' }}>
              Rootstock provides a shared foundation for execution, accounting, routing, liquidity,
              and extensibility. Developers compose these primitives into custom markets, keeping
              common protocol responsibilities in the core while market-specific logic lives in
              pools, hooks, and other modules.
            </Text>
          </FadeIn>
        </VStack>
      </DefaultPageContainer>
    </Noise>
  )
}
