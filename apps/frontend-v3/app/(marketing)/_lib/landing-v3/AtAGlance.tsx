'use client'

import { Box, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import Noise from '@repo/lib/shared/components/layout/Noise'

// At-a-glance section (Boss 2026-10-01): the whole system in one diagram,
// before any code — simple and informative, drawn from the hero artwork's
// language (seed core, orbital rings, root tendrils). Structure mirrors the
// docs v1 system diagram: Users -> Routers -> Vault -> Root Pools + Hooks
// -> Root Pool Tokens.
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
            One seed. Many markets.
          </Text>
          <Text color="font.secondary" fontSize="lg" maxW="2xl">
            The Vault is the root — every asset, one ledger. Pools carry the math, hooks add
            behavior, routers bring users in, and pool tokens carry liquidity outward.
          </Text>
        </VStack>
        <Box maxW="900px" mt="2xl" mx="auto" position="relative" w="full">
          <svg
            aria-label="ROOTSTOCK system diagram: users connect through routers to the Root Vault, which serves root pools and hooks; pool tokens carry liquidity outward"
            role="img"
            style={{ width: '100%', height: 'auto' }}
            viewBox="0 0 900 500"
          >
            {/* orbital rings — pools orbit the Vault seed */}
            <ellipse
              cx="450"
              cy="250"
              fill="none"
              rx="260"
              ry="150"
              stroke="rgba(201,171,126,0.18)"
              strokeWidth="1"
            />
            <ellipse
              cx="450"
              cy="250"
              fill="none"
              rx="340"
              ry="200"
              stroke="rgba(201,171,126,0.10)"
              strokeWidth="1"
            />
            <ellipse
              cx="450"
              cy="250"
              fill="none"
              rx="420"
              ry="250"
              stroke="rgba(201,171,126,0.06)"
              strokeWidth="1"
            />

            {/* root tendrils descending from the Vault seed */}
            <g fill="none" stroke="rgba(127,159,99,0.35)" strokeWidth="1.2">
              <path d="M450 310 C440 380 380 420 300 450" />
              <path d="M450 310 C465 380 540 420 620 450" opacity="0.7" />
              <path d="M450 310 C452 380 448 430 445 480" opacity="0.5" />
            </g>

            {/* users — top left */}
            <g>
              <rect
                fill="#241b12"
                height="44"
                rx="10"
                stroke="rgba(201,171,126,0.4)"
                width="120"
                x="60"
                y="70"
              />
              <text
                fill="#e8dcc3"
                fontSize="14"
                fontWeight="600"
                textAnchor="middle"
                x="120"
                y="97"
              >
                Users
              </text>
            </g>

            {/* routers — top, between users and vault */}
            <g>
              <rect
                fill="#241b12"
                height="44"
                rx="10"
                stroke="rgba(201,171,126,0.4)"
                width="120"
                x="250"
                y="70"
              />
              <text
                fill="#e8dcc3"
                fontSize="14"
                fontWeight="600"
                textAnchor="middle"
                x="310"
                y="97"
              >
                Routers
              </text>
            </g>

            {/* hooks — right of vault, on the outer orbit */}
            <g>
              <rect
                fill="#241b12"
                height="44"
                rx="10"
                stroke="rgba(201,171,126,0.4)"
                width="120"
                x="720"
                y="230"
              />
              <text
                fill="#e8dcc3"
                fontSize="14"
                fontWeight="600"
                textAnchor="middle"
                x="780"
                y="257"
              >
                Hooks
              </text>
            </g>

            {/* root pools — left of vault, on the outer orbit */}
            <g>
              <rect
                fill="#241b12"
                height="44"
                rx="10"
                stroke="rgba(201,171,126,0.4)"
                width="120"
                x="60"
                y="230"
              />
              <text
                fill="#e8dcc3"
                fontSize="14"
                fontWeight="600"
                textAnchor="middle"
                x="120"
                y="257"
              >
                Root Pools
              </text>
            </g>

            {/* pool tokens — bottom right */}
            <g>
              <rect
                fill="#241b12"
                height="44"
                rx="10"
                stroke="rgba(201,171,126,0.4)"
                width="130"
                x="620"
                y="430"
              />
              <text
                fill="#e8dcc3"
                fontSize="14"
                fontWeight="600"
                textAnchor="middle"
                x="685"
                y="457"
              >
                Pool Tokens
              </text>
            </g>

            {/* users -> routers */}
            <line
              stroke="rgba(201,171,126,0.5)"
              strokeWidth="1.5"
              x1="180"
              x2="250"
              y1="92"
              y2="92"
            />

            {/* routers -> vault seed */}
            <path
              d="M310 114 C330 150 380 190 430 220"
              fill="none"
              stroke="rgba(201,171,126,0.5)"
              strokeWidth="1.5"
            />

            {/* vault -> pools */}
            <line
              stroke="rgba(201,171,126,0.5)"
              strokeWidth="1.5"
              x1="340"
              x2="180"
              y1="252"
              y2="252"
            />

            {/* vault -> hooks (dashed — optional behavior) */}
            <line
              stroke="rgba(201,171,126,0.3)"
              strokeDasharray="4 3"
              strokeWidth="1.5"
              x1="560"
              x2="720"
              y1="252"
              y2="252"
            />

            {/* vault -> pool tokens */}
            <path
              d="M520 290 C570 350 620 400 650 430"
              fill="none"
              stroke="rgba(201,171,126,0.5)"
              strokeWidth="1.5"
            />

            {/* the Vault seed — glowing core */}
            <defs>
              <radialGradient cx="50%" cy="50%" id="seedGlow" r="50%">
                <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#d4a24c" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#d4a24c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="450" cy="250" fill="url(#seedGlow)" r="80" />
            <circle cx="450" cy="250" fill="#2b2114" r="44" stroke="#c9ab7e" strokeWidth="1.5" />
            <text fill="#e8dcc3" fontSize="13" fontWeight="700" textAnchor="middle" x="450" y="244">
              Root Vault
            </text>
            <text fill="rgba(232,220,195,0.6)" fontSize="10" textAnchor="middle" x="450" y="262">
              the seed
            </text>
          </svg>
        </Box>
      </DefaultPageContainer>
    </Noise>
  )
}
