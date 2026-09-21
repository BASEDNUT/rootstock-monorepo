'use client'

import { Box, Button, Card, HStack, Link, Stack, Text, VStack } from '@chakra-ui/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { ArrowUpRight } from 'lucide-react'

const VAULT = '0x846E88618A15766940277471509511bf69443CC1'
const APP_URL = `https://app.morpho.org/base/vault/${VAULT}/based-nut-usd#overview`
const CURATOR_URL = `https://curator.morpho.org/vaults/8453/${VAULT}`

const facts = [
  { label: 'Vault', value: 'BASED NUT USD (nutUSD)' },
  { label: 'Lends', value: 'USDC' },
  { label: 'Collateral', value: 'cbBTC · cbETH' },
  { label: 'Max LTV', value: '38.5%' },
  { label: 'Managed by', value: 'BASED NUT multisig (2-of-3)' },
  { label: 'Network', value: 'Base mainnet' },
]

export default function NutUsdPage() {
  return (
    <DefaultPageContainer>
      <VStack alignItems="start" pt="2xl" spacing="xl" w="full">
        <VStack alignItems="start" spacing="sm">
          <Text
            background="font.special"
            backgroundClip="text"
            fontSize="sm"
            variant="eyebrow"
          >
            BASED NUT's Rootstock
          </Text>
          <Text
            as="h1"
            color="font.primary"
            fontSize={{ base: '3xl', lg: '4xl' }}
            fontWeight="bold"
            letterSpacing="-0.04rem"
            lineHeight={1}
          >
            nutUSD
          </Text>
          <Text color="font.secondary" fontSize="lg" maxW="2xl">
            A USDC lending vault on Morpho Blue. Supply USDC and earn from lending against cbBTC
            and cbETH collateral — allocations are managed by the vault curator.
          </Text>
        </VStack>

        <Card w="full">
          <VStack alignItems="start" p="lg" spacing="md" w="full">
            <Text color="font.primary" fontWeight="bold">
              Vault facts
            </Text>
            <Stack direction={{ base: 'column', md: 'row' }}
              spacing="md"
              w="full"
              wrap="wrap"
            >
              {facts.map(f => (
                <Box bg="background.level2" key={f.label} minW="200px" p="md" rounded="lg">
                  <Text color="font.secondary" fontSize="sm">
                    {f.label}
                  </Text>
                  <Text color="font.primary" fontWeight="bold">
                    {f.value}
                  </Text>
                </Box>
              ))}
            </Stack>
            <Text color="font.secondary" fontSize="sm">
              Vault address: <span style={{ fontFamily: 'monospace' }}>{VAULT}</span>
            </Text>
          </VStack>
        </Card>

        <HStack>
          <Button
            as={Link}
            href={APP_URL}
            isExternal
            rightIcon={<ArrowUpRight size="14px" />}
            size="lg"
            variant="primary"
          >
            Open in Morpho
          </Button>
          <Button
            as={Link}
            href={CURATOR_URL}
            isExternal
            rightIcon={<ArrowUpRight size="14px" />}
            size="lg"
            variant="secondary"
          >
            Curator (admin)
          </Button>
        </HStack>

        <Text color="font.secondary" fontSize="sm" maxW="2xl">
          Deposit, withdraw, and vault management all run through the Morpho Curator app — the
          official interface for this vault. ROOTSTOCK links to it directly so the interaction
          surface always stays current.
        </Text>
      </VStack>
    </DefaultPageContainer>
  )
}
