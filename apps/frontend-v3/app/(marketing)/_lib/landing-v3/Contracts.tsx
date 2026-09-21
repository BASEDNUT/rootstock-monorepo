'use client'

/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Box, Card, Grid, GridItem, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'

// @ts-ignore
import { Code } from 'lucide-react'
import { AddIcon, MinusIcon } from '@chakra-ui/icons'
import { useState } from 'react'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { AnimatePresence, motion } from 'motion/react'
import { RadialPattern } from './shared/RadialPattern'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { WordsPullUp } from '@repo/lib/shared/components/animations/WordsPullUp'
import { FadeIn } from '@repo/lib/shared/components/animations/FadeIn'

const contracts = [
  {
    title: 'Root Vault',
    shortDescription: 'Holds every asset and keeps one ledger for every pool',
    description:
      'The Root Vault is the core of the engine — one smart contract that holds and manages all tokens in every pool. It separates token accounting from pool logic, so pools stay simple and carry only their market math.\n\nOne vault means one place to audit and one ledger to trust. Swaps, adds, and removes settle atomically against it in a single transaction — pools never hold tokens themselves.',
    tags: {
      Features: [
        'Transient accounting',
        'ERC20MultiToken',
        'Liquidity buffers',
        'Decimal scaling',
        'Rate scaling',
        'Yield fee',
        'Swap fee',
        'Live balances',
        'Liquidity invariant approximation',
      ],
    },
  },
  {
    title: 'Root Pools',
    shortDescription: 'The market math, attached to the Vault',
    description:
      'Pools define how traders swap between tokens. Anyone can create custom pool types — weighted, stable, boosted, or entirely custom curves — with flexibility bounded only by the math you write.\n\nBecause a pool is only its math, a new pool type is a small contract — not a fork of the whole engine. Register it with the Vault and it inherits accounting, scaling, and fee plumbing on day one.',
    tags: {
      'Pool types': [
        'Weighted pools',
        'Stable pools',
        'Boosted pools',
        'reCLAMM',
        'Launch pools',
        'Custom math',
      ],
    },
  },
  {
    title: 'Root Hooks',
    shortDescription: 'Policies that run before and after every market operation',
    description:
      'Hooks extend pool behavior at key points throughout the pool lifecycle. A hook is a standalone contract with its own logic and state — one hook can serve many pools and pool types.\n\nA hook can compute dynamic swap fees, guard against hostile quotes, or attach custom accounting to any lifecycle point. Since hooks are standalone, one deployment serves every pool that opts in.',
    tags: {
      'Lifecycle points': [
        'On pool register',
        'Initialization',
        'Adds',
        'Removes',
        'Swaps',
        'Dynamic swap fees',
      ],
    },
  },
  {
    title: 'Root Routers',
    shortDescription: 'The entry point for swaps and liquidity, users and solvers',
    description:
      'Routers are the primary interface for users and solvers, abstracting multi-step operations into simple functions — the entry point for swaps, liquidity operations, and batch execution.\n\nMulti-step operations — a swap routed through several pools, an unbalanced liquidity add, a batch of user intents — collapse into one call. Aggregators and solvers integrate once and reach every pool in the engine.',
    tags: {
      Capabilities: [
        'Operation aggregation',
        'Quotes',
        'Pathing',
        'Batch execution',
        'Custom logic',
      ],
    },
  },
]

function ContractCard({
  contract,
  isExpanded,
  onToggle,
}: {
  contract: (typeof contracts)[number]
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <Card h="full" w="full">
      <VStack alignItems="start" spacing="lg" w="full">
        <HStack alignItems="center" justifyContent="space-between" w="full">
          <HStack>
            <Box color="font.secondary">
              <Code size={16} />
            </Box>
            <Text color="font.secondary">Smart contract</Text>
          </HStack>
          <IconButton
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            fontSize="12px"
            h="30px"
            icon={isExpanded ? <MinusIcon /> : <AddIcon />}
            isRound
            onClick={onToggle}
            size="xs"
            variant="primary"
            w="30px"
          />
        </HStack>
        <VStack alignItems="start" mb="lg">
          <HStack justifyContent="space-between" w="full">
            <Text fontSize="xl" fontWeight="bold">
              {contract.title}
            </Text>
            
          </HStack>

          <Text color="font.secondary" sx={{ textWrap: 'balance' }} w="80%">
            {contract.shortDescription}
          </Text>
          {isExpanded && (
            <Text color="font.secondary" fontSize="lg" mt="sm" whiteSpace="pre-line">
              {contract.description}
            </Text>
          )}
        </VStack>
      </VStack>
    </Card>
  )
}

const MotionGridItem = motion(GridItem)

export function Contracts() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const { isMobile } = useBreakpoints()

  return (
    <Noise>
      <Box position="relative">
        <Box
          bottom={0}
          h="700px"
          left={0}
          position="absolute"
          right={0}
          top="10rem"
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
        <DefaultPageContainer
          minH="800px"
          noVerticalPadding
          position="relative"
          py={['3xl', '10rem']}
        >
          <Grid gap="xl" templateColumns={{ base: 'repeat(1, 1fr)', lg: 'repeat(2, 1fr)' }}>
            {!isMobile && <GridItem />}
            <GridItem borderRadius="lg">
              <VStack alignItems="start" spacing="md">
                <WordsPullUp
                  as="h3"
                  color="font.primary"
                  fontSize="4xl"
                  fontWeight="bold"
                  letterSpacing="-0.04rem"
                  lineHeight={1}
                  text="The engine"
                />
                <FadeIn delay={0.2} direction="up" duration={0.6}>
                  <Text color="font.secondary" fontSize="lg">
                    Four contracts form one core. The Root Vault holds the accounting and the assets —
                    pools, hooks, and routers attach to it.
                  </Text>
                </FadeIn>
              </VStack>
              <AnimatePresence initial={false} mode="wait">
                <Grid
                  gap="md"
                  mt="2xl"
                  position="relative"
                  templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
                  templateRows="repeat(2, minmax(200px, auto))"
                >
                  {contracts.map((contract, index) => (
                    <MotionGridItem
                      animate={{
                        opacity: expandedCard && expandedCard !== contract.title ? 0 : 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0,
                      }}
                      gridColumn={expandedCard === contract.title ? 'span 2' : 'auto'}
                      gridRow={expandedCard === contract.title ? 'span 2' : 'auto'}
                      initial={{
                        opacity: 1,
                        scale: 1,
                      }}
                      key={contract.title}
                      layout
                      order={expandedCard && expandedCard == contract.title ? 0 : index + 1}
                      style={{
                        display:
                          expandedCard && expandedCard !== contract.title ? 'hidden' : 'block',
                        position:
                          expandedCard && expandedCard !== contract.title ? 'absolute' : 'relative',
                      }}
                      transition={{
                        layout: {
                          type: 'spring',
                          bounce: 0.2,
                          duration: 0.4,
                        },
                        opacity: { duration: 0.2 },
                      }}
                    >
                      <ContractCard
                        contract={contract}
                        isExpanded={expandedCard === contract.title}
                        onToggle={() =>
                          setExpandedCard(expandedCard === contract.title ? null : contract.title)
                        }
                      />
                    </MotionGridItem>
                  ))}
                </Grid>
              </AnimatePresence>
            </GridItem>
          </Grid>
        </DefaultPageContainer>
      </Box>
    </Noise>
  )
}
