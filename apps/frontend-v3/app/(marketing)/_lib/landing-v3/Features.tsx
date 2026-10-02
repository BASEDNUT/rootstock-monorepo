'use client'

import { Box, Grid, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { WordsPullUp } from '@repo/lib/shared/components/animations/WordsPullUp'
import { FadeIn } from '@repo/lib/shared/components/animations/FadeIn'

// Section 3 — Built into the stack (approved copy, Boss 2026-10-01).
// Technical-feature grid: name + plain-English explanation, full descriptions
// preserved (accessibility law: concept before deeper technical implication).
const stackFeatures = [
  {
    title: 'LVR / MEV Mitigation',
    description:
      'Pools can use hooks and external execution systems to reduce harmful MEV and improve how trades are routed. The framework leaves room for different mitigation strategies instead of forcing one model on every market.',
  },
  {
    title: 'Decimal Scaling',
    description:
      'Tokens do not all use the same number of decimals. The Root Vault normalizes their values before they reach the pool, giving pool math a consistent 18-decimal format to work with.',
  },
  {
    title: 'Rate Scaling',
    description:
      'Some assets change in value relative to their underlying token over time. The Root Vault can account for those rates automatically, giving pools rate-adjusted balances without requiring custom scaling logic.',
  },
  {
    title: 'Liquidity Invariant Approximation',
    description:
      "Liquidity does not always have to enter or leave a pool in perfect proportions. Rootstock can calculate the effect of an unbalanced deposit or withdrawal against the pool's invariant, giving users more flexible ways to manage liquidity.",
  },
  {
    title: 'Transient Accounting',
    description:
      'The Root Vault can track temporary changes during a transaction and require everything to settle correctly before it finishes. EIP-1153 makes this pattern efficient and enables more complex interactions without permanently storing every intermediate state.',
  },
  {
    title: 'ERC20MultiToken',
    description:
      'Pool token balances and supply are updated together inside the Vault. Keeping those changes atomic reduces unnecessary state changes and helps eliminate classes of inconsistent-state and read-only reentrancy problems.',
  },
  {
    title: 'Swap Fee Management',
    description:
      'Pools share a common system for charging and accounting for swap fees. Individual markets can still customize fee behavior through their configuration and hooks.',
  },
  {
    title: 'Pool Creator Fees',
    description:
      'A pool can direct part of its swap fees to its creator. This gives developers a native way to build sustainable economics around new market designs.',
  },
  {
    title: 'Pool Pause Manager',
    description:
      'Pools can define when emergency pausing is available and who can use it. The Root Vault enforces those rules at the protocol level instead of requiring every pool to implement its own pause system.',
  },
]

export function Features() {
  return (
    <Noise position="relative">
      <DefaultPageContainer
        minH="800px"
        noVerticalPadding
        position="relative"
        py={['3xl', '10rem']}
      >
        <VStack alignItems="start" maxW="900px" spacing="lg">
          <WordsPullUp
            as="h2"
            color="font.primary"
            fontSize={{ base: '4xl', md: '6xl' }}
            fontWeight="bold"
            letterSpacing="-0.04rem"
            lineHeight={1.05}
            pr="2"
            text="Built into the stack"
          />
          <FadeIn delay={0.2} direction="up" duration={0.6}>
            <Text color="font.secondary" fontSize="lg" sx={{ textWrap: 'pretty' }}>
              Rootstock handles more of the difficult infrastructure at the protocol level, so every
              pool does not have to solve the same problems again. Scaling, accounting, fees,
              liquidity operations, and safety controls are built into the stack and shared across
              markets.
            </Text>
          </FadeIn>
        </VStack>
        <Grid
          gap="xl"
          mt="2xl"
          templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
        >
          {stackFeatures.map(feature => (
            <FadeIn direction="up" key={feature.title}>
              <Box background="background.level0" h="full" p="lg" rounded="lg">
                <Text fontSize="xl" fontWeight="bold" pb="md">
                  {feature.title}
                </Text>
                <Text color="font.secondary" fontSize="md" sx={{ textWrap: 'pretty' }}>
                  {feature.description}
                </Text>
              </Box>
            </FadeIn>
          ))}
        </Grid>
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
