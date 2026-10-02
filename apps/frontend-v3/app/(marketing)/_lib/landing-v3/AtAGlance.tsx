'use client'

import { Box, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'

// At-a-glance section (Boss 2026-10-01): the whole system in one diagram,
// before any code — simple and informative. Artwork v2 (Boss upload, same
// day): architecture SVG ported verbatim — only HTML-SVG syntax converted
// to JSX; geometry, colors, and seed glyphs are the artwork's own.
// Root Vault seed core with orbital rings feeding Pools, Edges, Markets.
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
          >
            A smaller core. A wider design space.
          </Text>
          <Text color="font.secondary" fontSize="lg" maxW="2xl">
            Accounting, balances, fees, and scaling stay in the Root Vault. Pools carry only their
            market math. Hooks, routers, and modules shape what each market becomes.
          </Text>
        </VStack>
        <Box
          bg="background.level0"
          borderColor="border.base"
          borderWidth="1px"
          maxW="760px"
          mt="2xl"
          mx="auto"
          p={{ base: 'md', md: 'xl' }}
          rounded="2xl"
          w="full"
        >
          <svg
            aria-label="Rootstock architecture diagram: the Root Vault shared core feeds pools, edges, and markets"
            role="img"
            style={{ display: 'block', height: 'auto', width: '100%' }}
            viewBox="0 0 590 310"
          >
            {/* Root Vault — the seed core with orbital rings */}
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

            {/* the core feeds the three node families */}
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
        </Box>
      </DefaultPageContainer>
    </Noise>
  )
}
