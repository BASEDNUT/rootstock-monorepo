'use client'

import { Box, Button, Card, Heading, HStack, Input, Link, Text, VStack } from '@chakra-ui/react'
import { useState } from 'react'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { ConnectWallet } from '@repo/lib/modules/web3/ConnectWallet'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { NetworkSwitchButton } from '@repo/lib/modules/web3/useChainSwitch'
import { useInvalidateFactoryTokens } from '@repo/lib/modules/primitives/useInvalidateFactoryTokens'
import { TOKEN_FACTORY, PRIMITIVES_CHAIN_ID } from '@repo/lib/modules/primitives/primitives.config'
import { tokenFactoryAbi } from '@repo/lib/modules/primitives/primitivesAbi'
import {
  parsePrimitiveError,
  isWalletRejection,
} from '@repo/lib/modules/primitives/primitive-errors'
import { useWriteContract } from '@repo/lib/shared/utils/wagmi'
import { discoveryClient } from '@repo/lib/modules/pool/onchain-pool-fetch'

/**
 * PRD-07 Primitive 1 — Mint token (S106).
 * TokenFactory.create(name, symbol, supply) — fixed-supply OZ ERC-20,
 * full supply to the creator, one tx. 18 decimals is the ERC-20 standard
 * default (OZ ERC20, same as WETH/NUT) — fixed at deploy, not choosable.
 * New token appears in every picker via TokenCreated event discovery.
 */
export default function MintTokenPage() {
  const { isConnected } = useUserAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [supply, setSupply] = useState('')
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()

  const { writeContractAsync } = useWriteContract()
  const invalidateFactoryTokens = useInvalidateFactoryTokens()
  const queryClient = useQueryClient()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const decimals = 18

  const parsedSupply = (() => {
    try {
      return supply ? parseUnits(supply, decimals) : 0n
    } catch {
      return 0n
    }
  })()

  const isValid =
    name.trim().length > 0 &&
    symbol.trim().length > 0 &&
    supply.trim().length > 0 &&
    parsedSupply > 0n

  async function handleMint() {
    setError(undefined)
    setSuccess(undefined)
    setIsSubmitting(true)

    try {
      const hash = await writeContractAsync({
        abi: tokenFactoryAbi,
        address: TOKEN_FACTORY as `0x${string}`,
        functionName: 'create',
        args: [name, symbol, parsedSupply],
        chainId: PRIMITIVES_CHAIN_ID,
      })

      // wait for the on-chain receipt, then refresh pickers (frontend-ux Rule 1)
      const client = discoveryClient()
      const txReceipt = await client.waitForTransactionReceipt({ hash })

      invalidateFactoryTokens()
      queryClient.invalidateQueries({ queryKey: ['onchain-pool-tokens', 'basesep'] })

      setSuccess(`Token created! It now appears in every picker. Tx: ${hash.slice(0, 10)}…`)
      setName('')
      setSymbol('')
      setSupply('')
      void txReceipt
    } catch (e) {
      if (!isWalletRejection(e)) setError(parsePrimitiveError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DefaultPageContainer>
      <VStack alignItems="start" pt="2xl" spacing="xl" w="full">
        <VStack alignItems="start" spacing="sm">
          <Text background="font.special" backgroundClip="text" fontSize="sm" variant="eyebrow">
            PRIMITIVES
          </Text>
          <Heading as="h1" size="2xl">
            Mint a token
          </Heading>
          <Text color="font.secondary" maxW="600px">
            Deploy a fixed-supply ERC-20 in one transaction. The full supply is minted to you at
            creation. No admin, no mint-after-deploy, no fees. Your token instantly appears in every
            picker across the app.
          </Text>
        </VStack>

        <Card maxW="600px" p="xl" w="full">
          <VStack align="start" spacing="md" w="full">
            {/* S106 Boss correction (2026-09-28): the form is ALWAYS visible —
                grok-first, wallet only to act (same law as /lbp). */}
            {isConnected ? <NetworkSwitchButton chainId={PRIMITIVES_CHAIN_ID} /> : null}

            <Box w="full">
              <Text color="font.secondary" fontSize="sm" mb="xs">
                Name
              </Text>
              <Input
                maxLength={64}
                onChange={e => setName(e.target.value)}
                placeholder="My Token"
                value={name}
              />
            </Box>

            <Box w="full">
              <Text color="font.secondary" fontSize="sm" mb="xs">
                Symbol
              </Text>
              <Input
                maxLength={11}
                onChange={e => setSymbol(e.target.value)}
                placeholder="MYT"
                value={symbol}
              />
            </Box>

            <Box w="full">
              <Text color="font.secondary" fontSize="sm" mb="xs">
                Total supply (whole tokens)
              </Text>
              <Input
                inputMode="numeric"
                onChange={e => setSupply(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="1000000"
                type="text"
                value={supply}
              />
              <Text color="font.secondary" fontSize="xs" mt="xs">
                Decimals: 18 — the ERC-20 standard, fixed at deploy (verified onchain). Not
                choosable. Preview:{' '}
                {parsedSupply > 0n ? Number(supply).toLocaleString('en-US') : '—'} whole tokens.
              </Text>
            </Box>

            {error ? (
              <Text color="font.error" fontSize="sm" w="full">
                {error}
              </Text>
            ) : null}

            {success ? (
              <Text color="font.success" fontSize="sm" w="full">
                {success}
              </Text>
            ) : null}

            {!isConnected ? (
              <ConnectWallet size="lg" w="full" />
            ) : (
              <Button
                isDisabled={!isValid || isSubmitting}
                isLoading={isSubmitting}
                loadingText="Minting…"
                onClick={handleMint}
                size="lg"
                variant="primary"
                w="full"
              >
                {isSubmitting ? 'Minting…' : 'Mint token'}
              </Button>
            )}
          </VStack>
        </Card>

        <Card maxW="600px" p="xl" w="full">
          <VStack align="start" spacing="sm" w="full">
            <Heading as="h2" size="md">
              What you get
            </Heading>
            <Text color="font.secondary" fontSize="sm">
              A plain OZ ERC-20: your name, your symbol, 18 standard decimals, the full supply in
              your wallet at creation. Fixed forever — no admin key, no mint function, no fees,
              nothing to administer.
            </Text>
            <Text color="font.secondary" fontSize="sm">
              The factory owns nothing and holds nothing. Anything sent directly to the factory or
              your token&apos;s address by mistake is unrecoverable — no admin exists to rescue it.
            </Text>
            <HStack spacing="md">
              <Link
                fontSize="sm"
                href={`https://base-sepolia.blockscout.com/address/${TOKEN_FACTORY}`}
                isExternal
              >
                Factory on Blockscout ↗
              </Link>
              <Link fontSize="sm" href="/wrap">
                Next: wrap a token →
              </Link>
              <Link fontSize="sm" href="/create">
                Then: create a pool →
              </Link>
            </HStack>
          </VStack>
        </Card>
      </VStack>
    </DefaultPageContainer>
  )
}
