'use client'

import { Box, Button, Flex, Grid, GridItem, HStack, Link, Text, VStack } from '@chakra-ui/react'
import { ArrowUpRight } from 'lucide-react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'

// At-a-glance section (Boss 2026-10-01): the whole system in one panel,
// before any code. Full artwork port (Boss upload, same day): architecture
// SVG + three feature SVGs + closing bar — geometry, colors, and seed
// glyphs are the artwork's own; only HTML-SVG syntax converted to JSX.
// Copy changed per Boss: no verbatim of approved section copy, and the
// upload's nonsensical header copy does not ship.
const svgLine: React.CSSProperties = {
  fill: 'none',
  stroke: '#95785d',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
}

const svgLineSoft: React.CSSProperties = {
  fill: 'none',
  stroke: '#624f3f',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.15,
}

const svgNode: React.CSSProperties = {
  fill: '#29211c',
  stroke: '#7b6049',
  strokeWidth: 1.3,
}

const svgNodeAccent: React.CSSProperties = {
  fill: '#e0b77f',
  stroke: '#efd0a6',
  strokeWidth: 1.15,
}

const svgText: React.CSSProperties = {
  fill: '#eee2d5',
  fontFamily: 'Inter, sans-serif',
  fontSize: '13.5px',
  fontWeight: 680,
}

const svgSmall: React.CSSProperties = {
  fill: '#c2ad97',
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px',
  fontWeight: 600,
}

const svgRoot: React.CSSProperties = {
  fill: '#2b211b',
  fontFamily: 'Inter, sans-serif',
  fontSize: '11px',
  fontWeight: 780,
  letterSpacing: '.12em',
}

const svgMicro: React.CSSProperties = {
  fill: '#6f5c4a',
  fontFamily: 'Inter, sans-serif',
  fontSize: '10.5px',
  fontWeight: 680,
  letterSpacing: '.08em',
}

function ArchitectureSvg() {
  return (
    <svg
      aria-label="Rootstock architecture diagram: the Root Vault shared core feeds pools, edges, and markets"
      role="img"
      style={{ display: 'block', height: 'auto', width: '100%' }}
      viewBox="0 0 590 310"
    >
      <circle cx="177" cy="155" r="78" style={svgNodeAccent} />
      <circle cx="177" cy="155" r="94" strokeDasharray="4 7" style={svgLineSoft} />
      <circle cx="177" cy="155" opacity=".32" r="105" style={svgLineSoft} />
      <text style={{ fontSize: '20px' }} textAnchor="middle" x="149" y="150">
        🥜
      </text>
      <text style={{ fontSize: '20px' }} textAnchor="middle" x="177" y="150">
        🌰
      </text>
      <text style={{ fontSize: '20px' }} textAnchor="middle" x="205" y="150">
        🥥
      </text>
      <text style={svgRoot} textAnchor="middle" x="177" y="180">
        ROOT VAULT
      </text>
      <text style={svgMicro} textAnchor="middle" x="177" y="199">
        SHARED CORE
      </text>

      <path d="M252 118 C300 91 337 80 379 76" style={svgLine} />
      <path d="M255 155 H399" style={svgLine} />
      <path d="M252 192 C301 219 337 230 379 234" style={svgLine} />

      <circle cx="271" cy="108" fill="#95785d" r="2.5" />
      <circle cx="279" cy="155" fill="#95785d" r="2.5" />
      <circle cx="271" cy="202" fill="#95785d" r="2.5" />

      <rect height="58" rx="11" style={svgNode} width="178" x="378" y="47" />
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="400" y="68">
        🌰
      </text>
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="400" y="86">
        🥜
      </text>
      <text style={svgText} x="423" y="69">
        Pools
      </text>
      <text style={svgSmall} x="423" y="89">
        pool * vaults
      </text>

      <rect height="58" rx="11" style={svgNode} width="161" x="395" y="126" />
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="415" y="147">
        🌰
      </text>
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="415" y="165">
        🥜
      </text>
      <text style={svgText} x="438" y="148">
        Edges
      </text>
      <text style={svgSmall} x="438" y="168">
        hooks · router
      </text>

      <rect height="58" rx="11" style={svgNode} width="178" x="378" y="205" />
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="400" y="226">
        🥥
      </text>
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="400" y="244">
        🥜
      </text>
      <text style={svgText} x="423" y="227">
        Markets
      </text>
      <text style={svgSmall} x="423" y="247">
        wrappers · LBP
      </text>
    </svg>
  )
}

function RootVaultFeatureSvg() {
  return (
    <svg
      aria-hidden="true"
      style={{ display: 'block', height: 'auto', width: '100%', maxWidth: 292 }}
      viewBox="0 0 292 126"
    >
      <circle cx="50" cy="63" r="33" style={svgNodeAccent} />
      <circle cx="50" cy="63" opacity=".45" r="42" strokeDasharray="3 6" style={svgLineSoft} />
      <text style={{ fontSize: '20px' }} textAnchor="middle" x="50" y="69">
        🥜
      </text>
      <path d="M84 63 H127" style={svgLine} />
      <path d="M127 29 V97" style={svgLineSoft} />
      <path d="M127 36 H198" style={svgLineSoft} />
      <path d="M127 63 H198" style={svgLineSoft} />
      <path d="M127 90 H198" style={svgLineSoft} />
      <text style={svgSmall} x="209" y="41">
        balances
      </text>
      <text style={svgSmall} x="209" y="68">
        fees
      </text>
      <text style={svgSmall} x="209" y="95">
        scaling
      </text>
    </svg>
  )
}

function EdgeExtensionsFeatureSvg() {
  return (
    <svg
      aria-hidden="true"
      style={{ display: 'block', height: 'auto', width: '100%', maxWidth: 292 }}
      viewBox="0 0 292 126"
    >
      <rect height="40" rx="10" style={svgNodeAccent} width="92" x="15" y="43" />
      <text style={{ fontSize: '17px' }} textAnchor="middle" x="46" y="69">
        🥜
      </text>
      <text style={{ fontSize: '17px' }} textAnchor="middle" x="75" y="69">
        🌰
      </text>
      <path d="M107 63 H151" style={svgLine} />
      <circle cx="151" cy="63" fill="#95785d" r="3" />
      <path d="M151 63 C176 63 177 29 204 29" style={svgLine} />
      <path d="M151 63 H204" style={svgLine} />
      <path d="M151 63 C176 63 177 97 204 97" style={svgLine} />
      <circle cx="225" cy="29" r="19" style={svgNode} />
      <circle cx="225" cy="63" r="19" style={svgNode} />
      <circle cx="225" cy="97" r="19" style={svgNode} />
      <text style={svgSmall} textAnchor="middle" x="225" y="33">
        hooks
      </text>
      <text style={svgSmall} textAnchor="middle" x="225" y="67">
        router
      </text>
      <text style={svgSmall} textAnchor="middle" x="225" y="101">
        mods
      </text>
    </svg>
  )
}

function MarketCompositionFeatureSvg() {
  return (
    <svg
      aria-hidden="true"
      style={{ display: 'block', height: 'auto', width: '100%', maxWidth: 292 }}
      viewBox="0 0 292 126"
    >
      <circle cx="146" cy="63" r="23" style={svgNodeAccent} />
      <circle cx="146" cy="63" opacity=".45" r="31" strokeDasharray="3 5" style={svgLineSoft} />
      <text style={{ fontSize: '18px' }} textAnchor="middle" x="146" y="69">
        🥜
      </text>
      <circle cx="72" cy="30" r="21" style={svgNode} />
      <circle cx="72" cy="96" r="21" style={svgNode} />
      <circle cx="220" cy="30" r="21" style={svgNode} />
      <circle cx="220" cy="96" r="21" style={svgNode} />
      <path d="M92 39 L124 53" style={svgLine} />
      <path d="M92 87 L124 73" style={svgLine} />
      <path d="M168 53 L200 39" style={svgLine} />
      <path d="M168 73 L200 87" style={svgLine} />
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="72" y="24">
        🌰
      </text>
      <text style={svgSmall} textAnchor="middle" x="72" y="40">
        LBP
      </text>
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="72" y="90">
        🥥
      </text>
      <text style={svgSmall} textAnchor="middle" x="72" y="106">
        wrap
      </text>
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="220" y="24">
        🥜
      </text>
      <text style={svgSmall} textAnchor="middle" x="220" y="40">
        pool
      </text>
      <text style={{ fontSize: '14px' }} textAnchor="middle" x="220" y="90">
        🌰
      </text>
      <text style={svgSmall} textAnchor="middle" x="220" y="106">
        launch
      </text>
    </svg>
  )
}

const features = [
  {
    title: 'Root Vault',
    copy: 'Centralize shared accounting so pool contracts stay focused on market math.',
    svg: <RootVaultFeatureSvg />,
  },
  {
    title: 'Edge Extensions',
    copy: 'Put custom behavior at the edges without turning the core into a monolith.',
    svg: <EdgeExtensionsFeatureSvg />,
  },
  {
    title: 'Market Composition',
    copy: 'Combine pools, wrappers, launchpads, and liquidity structures around the same base.',
    svg: <MarketCompositionFeatureSvg />,
  },
]

const layerList = ['Vault', 'Pools', 'Extensions']

export function AtAGlance() {
  return (
    <Noise position="relative">
      <DefaultPageContainer noVerticalPadding position="relative" py={['3xl', '10rem']}>
        <VStack alignItems="center" spacing="lg" textAlign="center">
          <Text background="font.special" backgroundClip="text" fontSize="sm" variant="eyebrow">
            The system at a glance
          </Text>
          <Text
            color="font.primary"
            fontSize={{ base: '3xl', md: '5xl' }}
            fontWeight="bold"
            lineHeight={1.05}
            maxW="900px"
          >
            A smaller core. A wider design space.
          </Text>
        </VStack>

        <Box
          bg="background.level0"
          borderColor="border.base"
          borderWidth="1px"
          mt="2xl"
          overflow="hidden"
          rounded="2xl"
          w="full"
        >
          <Grid templateColumns={{ base: '1fr', lg: '1.15fr 1fr' }}>
            <Box p={{ base: 'lg', lg: 'xl' }}>
              <ArchitectureSvg />
            </Box>
            <VStack
              alignItems="start"
              borderColor="border.base"
              borderLeftWidth={{ base: '0', lg: '1px' }}
              borderTopWidth={{ base: '1px', lg: '0' }}
              justify="center"
              p={{ base: 'lg', lg: 'xl' }}
              spacing="md"
            >
              <Text background="font.special" backgroundClip="text" fontSize="sm" variant="eyebrow">
                Core responsibilities, edge rules
              </Text>
              <Text color="font.secondary" fontSize="lg" sx={{ textWrap: 'pretty' }}>
                Accounting, balances, fees, and scaling stay in the Root Vault. Pools carry only
                their market math. Hooks, routers, and modules shape what each market becomes.
              </Text>
              <HStack pt="sm" spacing="md">
                {layerList.map((layer, i) => (
                  <HStack key={layer} spacing="xs">
                    {i > 0 && <Box bg="border.base" h="12px" w="1px" />}
                    <Box background="font.special" h="4px" rounded="full" w="4px" />
                    <Text color="font.secondary" fontSize="sm" fontWeight="medium">
                      {layer}
                    </Text>
                  </HStack>
                ))}
              </HStack>
            </VStack>
          </Grid>

          <Grid
            borderColor="border.base"
            borderTopWidth="1px"
            templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
          >
            {features.map((f, i) => (
              <GridItem
                borderColor="border.base"
                borderLeftWidth={{ base: '0', md: i > 0 ? '1px' : '0' }}
                borderTopWidth={{ base: i > 0 ? '1px' : '0', md: '0' }}
                key={f.title}
              >
                <VStack alignItems="start" p={{ base: 'lg', md: 'xl' }} spacing="md">
                  <Box w="full">{f.svg}</Box>
                  <Text fontSize="xl" fontWeight="bold">
                    {f.title}
                  </Text>
                  <Text color="font.secondary" fontSize="md" sx={{ textWrap: 'pretty' }}>
                    {f.copy}
                  </Text>
                </VStack>
              </GridItem>
            ))}
          </Grid>

          <Flex
            align="center"
            borderColor="border.base"
            borderTopWidth="1px"
            direction={{ base: 'column', md: 'row' }}
            gap="md"
            justify="space-between"
            p={{ base: 'lg', md: 'xl' }}
          >
            <Text color="font.secondary" fontSize="md" maxW="720px">
              One coherent foundation for building and extending Based Nut markets.
            </Text>
            <Button
              as={Link}
              href="https://docs.basednut.com/rootstock"
              isExternal
              rightIcon={<ArrowUpRight size="14px" />}
              size="md"
              variant="primary"
            >
              Read the docs
            </Button>
          </Flex>
        </Box>
      </DefaultPageContainer>
    </Noise>
  )
}
