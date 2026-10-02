'use client'

import { Box, Card, Flex, Link, Text, VStack } from '@chakra-ui/react'
import NextLink from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useOnchainPoolDiscovery } from '@repo/lib/modules/pool/useOnchainPoolDiscovery'

// New & interesting pools band (Boss 2026-10-01): real discovered pools —
// no fabricated TVL, no partner section (we have none). Pool data comes from
// the same baked registry + live factory-event scan that feeds the pool list.
export function NewPools() {
  const { data: pools, isLoading } = useOnchainPoolDiscovery(true)
  const discovered = pools ?? []

  if (!isLoading && discovered.length === 0) return null

  return (
    <Card mb="md">
      <VStack align="start" p="md" spacing="md" w="full">
        <Text color="font.secondary" fontSize="11px" variant="eyebrow">
          New & interesting pools
        </Text>
        <Flex gap="md" w="full" wrap="wrap">
          {isLoading && <Text color="font.secondary">Discovering pools onchain...</Text>}
          {discovered.map(pool => (
            <Link
              _hover={{ textDecoration: 'none' }}
              as={NextLink}
              flex={{ base: '1 1 100%', md: '1 1 30%' }}
              href={`/pools/base-sepolia/v3/${pool.address}`}
              key={pool.address}
            >
              <VStack
                _hover={{ borderColor: 'font.special' }}
                align="start"
                bg="background.level0"
                borderRadius="md"
                borderWidth="1px"
                p="md"
                spacing="xs"
                w="full"
              >
                <Text fontSize="md" fontWeight="bold">
                  {pool.name || pool.symbol}
                </Text>
                <Text color="font.secondary" fontSize="sm">
                  {pool.type.replace('_', ' ')}
                </Text>
                <Flex gap="xs" wrap="wrap">
                  {pool.poolTokens.map(t => (
                    <Box
                      bg="background.level1"
                      borderRadius="full"
                      fontSize="xs"
                      key={t.address}
                      px="sm"
                      py="2px"
                    >
                      {t.symbol}
                    </Box>
                  ))}
                </Flex>
              </VStack>
            </Link>
          ))}
        </Flex>
        <Link as={NextLink} color="font.special" fontSize="sm" href="/pools">
          View all pools <ArrowUpRight size="12px" style={{ display: 'inline' }} />
        </Link>
      </VStack>
    </Card>
  )
}
