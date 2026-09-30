'use client'

import {
  Box,
  Button,
  Card,
  Heading,
  HStack,
  Input,
  Link,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { erc20Abi, isAddress } from 'viem'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { ConnectWallet } from '@repo/lib/modules/web3/ConnectWallet'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { NetworkSwitchButton } from '@repo/lib/modules/web3/useChainSwitch'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import { TokenSelectModal } from '@repo/lib/modules/tokens/TokenSelectModal/TokenSelectModal'
import { TokenBalancesProvider } from '@repo/lib/modules/tokens/TokenBalancesProvider'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { useInvalidateFactoryTokens } from '@repo/lib/modules/primitives/useInvalidateFactoryTokens'
import {
  WRAPPER_FACTORY,
  PRIMITIVES_CHAIN_ID,
} from '@repo/lib/modules/primitives/primitives.config'
import { wrapperFactoryAbi } from '@repo/lib/modules/primitives/primitivesAbi'
import {
  parsePrimitiveError,
  isWalletRejection,
} from '@repo/lib/modules/primitives/primitive-errors'
import { useWriteContract, useReadContracts } from '@repo/lib/shared/utils/wagmi'
import { discoveryClient } from '@repo/lib/modules/pool/onchain-pool-fetch'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'

/**
 * PRD-07 Primitive 2 — Wrap token (S106).
 * WrapperFactory.create(underlying, name, symbol) — 1:1 OZ-style wrapper over
 * ANY ERC-20 (BPTs included), one tx. Decimals auto-inherit from the
 * underlying (read ONCHAIN live — the GUI never guesses). Self-wrap reverts.
 * New wrapper appears in every picker via WrapperCreated event discovery.
 */
export default function WrapTokenPage() {
  const { isConnected } = useUserAccount()
  const [underlying, setUnderlying] = useState('')
  const [underlyingLabel, setUnderlyingLabel] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tokenSelectDisclosure = useDisclosure()
  const tokenSelectBtn = useRef(null)
  const { getTokensByChain } = useTokens()
  const tokens = getTokensByChain(GqlChainValues.BaseSepolia)

  const { writeContractAsync } = useWriteContract()
  const invalidateFactoryTokens = useInvalidateFactoryTokens()
  const queryClient = useQueryClient()

  const isValidAddress = isAddress(underlying)

  // S106 GUI specificity: read the typed underlying ONCHAIN — real
  // name/symbol/decimals. A failed read = not a contract (or not ERC-20).
  // This is the same check the factory performs (code.length > 0 + constructor
  // calls decimals()). The GUI verifies, never guesses.
  const { data: underlyingMeta, isLoading: isLoadingMeta } = useReadContracts({
    contracts: isValidAddress
      ? [
          { address: underlying, abi: erc20Abi, functionName: 'name' as const },
          { address: underlying, abi: erc20Abi, functionName: 'symbol' as const },
          { address: underlying, abi: erc20Abi, functionName: 'decimals' as const },
        ]
      : [],
    allowFailure: true,
    query: { enabled: isValidAddress },
  })

  const metaOk =
    isValidAddress &&
    underlyingMeta &&
    underlyingMeta.length === 3 &&
    underlyingMeta.every(r => r.status === 'success')

  const isValid = isValidAddress && metaOk && name.trim().length > 0 && symbol.trim().length > 0

  async function handleWrap() {
    setError(undefined)
    setSuccess(undefined)
    setIsSubmitting(true)

    try {
      const hash = await writeContractAsync({
        abi: wrapperFactoryAbi,
        address: WRAPPER_FACTORY as `0x${string}`,
        functionName: 'create',
        args: [underlying as `0x${string}`, name, symbol],
        chainId: PRIMITIVES_CHAIN_ID,
      })

      // wait for the on-chain receipt, then refresh pickers (frontend-ux Rule 1)
      const client = discoveryClient()
      const txReceipt = await client.waitForTransactionReceipt({ hash })

      invalidateFactoryTokens()
      queryClient.invalidateQueries({ queryKey: ['onchain-pool-tokens', 'basesep'] })

      setSuccess(`Wrapper created! It now appears in every picker. Tx: ${hash.slice(0, 10)}…`)
      setUnderlying('')
      setUnderlyingLabel('')
      setName('')
      setSymbol('')
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
            Wrap a token
          </Heading>
          <Text color="font.secondary" maxW="600px">
            Create a 1:1 wrapper over any ERC-20 — pool tokens (BPTs) included. Wrap for wrapping,
            compose anywhere. Your wrapper instantly appears in every picker.
          </Text>
        </VStack>

        {/* S109 (Boss live E2E walk 2026-09-30): always-visible chain
            badge — the page is a Base Sepolia primitive; the chain must be
            obvious before any wallet is connected. */}
        <HStack>
          <NetworkIcon chain={GqlChainValues.BaseSepolia} size={7} />
          <Text color="font.secondary" fontSize="sm">
            Base Sepolia
          </Text>
        </HStack>

        <TokenBalancesProvider extTokens={tokens}>
          {/* S106 Boss correction (2026-09-28): the form is ALWAYS visible —
              grok-first, wallet only to act (same law as /lbp). */}
          {isConnected ? <NetworkSwitchButton chainId={PRIMITIVES_CHAIN_ID} /> : null}

          <Card maxW="600px" p="xl" w="full">
            <VStack align="start" spacing="md" w="full">
              <Box w="full">
                <Text color="font.secondary" fontSize="sm" mb="xs">
                  Underlying token (any ERC-20, BPTs included)
                </Text>
                <HStack w="full">
                  <Input
                    flex="1"
                    isInvalid={underlying.length > 0 && !isValidAddress}
                    onChange={e => {
                      setUnderlying(e.target.value.trim())
                      if (!isAddress(e.target.value.trim())) setUnderlyingLabel('')
                    }}
                    placeholder="0x… or pick from list"
                    value={underlying}
                  />
                  <Button
                    onClick={tokenSelectDisclosure.onOpen}
                    ref={tokenSelectBtn}
                    size="md"
                    variant="secondary"
                  >
                    Pick token
                  </Button>
                </HStack>
                {underlyingLabel ? (
                  <Text color="font.secondary" fontSize="sm" mt="xs">
                    {underlyingLabel}
                  </Text>
                ) : null}
                {underlying.length > 0 && !isValidAddress ? (
                  <Text color="font.error" fontSize="sm" mt="xs">
                    Enter a valid contract address.
                  </Text>
                ) : null}

                {/* Onchain verification of the typed underlying — read live
                    from the chain. A failed read means the address is not a
                    contract (or not an ERC-20) — the factory will reject it. */}
                {isValidAddress ? (
                  <Box mt="xs" w="full">
                    {isLoadingMeta ? (
                      <Text color="font.secondary" fontSize="xs">
                        Reading underlying onchain…
                      </Text>
                    ) : metaOk ? (
                      <VStack align="start" spacing="1" w="full">
                        <Text color="font.success" fontSize="xs">
                          ✓ Verified onchain: {String(underlyingMeta?.[1]?.result)} —{' '}
                          {String(underlyingMeta?.[0]?.result)}
                        </Text>
                        <Text color="font.secondary" fontSize="xs">
                          Wrapper will inherit {String(underlyingMeta?.[2]?.result)} decimals from
                          the underlying — automatic, not choosable.
                        </Text>
                      </VStack>
                    ) : (
                      <Text color="font.error" fontSize="xs">
                        ✗ Onchain read failed — address is not a contract or not an ERC-20. The
                        factory will reject it.
                      </Text>
                    )}
                  </Box>
                ) : null}
              </Box>

              <Box w="full">
                <Text color="font.secondary" fontSize="sm" mb="xs">
                  Wrapper name
                </Text>
                <Input
                  maxLength={64}
                  onChange={e => setName(e.target.value)}
                  placeholder="Wrapped My Token"
                  value={name}
                />
              </Box>

              <Box w="full">
                <Text color="font.secondary" fontSize="sm" mb="xs">
                  Wrapper symbol
                </Text>
                <Input
                  maxLength={11}
                  onChange={e => setSymbol(e.target.value)}
                  placeholder="wMYT"
                  value={symbol}
                />
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
                  loadingText="Wrapping…"
                  onClick={handleWrap}
                  size="lg"
                  variant="primary"
                  w="full"
                >
                  {isSubmitting ? 'Wrapping…' : 'Wrap token'}
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
                A 1:1 wrapper: deposit N underlying → mint N wrapper, withdraw N wrapper → burn for
                N underlying. Decimals inherit from the underlying automatically. Wrap a BPT, then
                pool the wrapper — compose anywhere.
              </Text>
              <Text color="font.secondary" fontSize="sm">
                Advisory: exotic underlyings (fee-on-transfer, rebasing) wrap lossy — the wrapper
                measures what actually arrives and stays solvent, but you can lose the fee portion.
                Plain ERC-20s and BPTs wrap clean.
              </Text>
              <Text color="font.secondary" fontSize="sm">
                The factory owns nothing and holds nothing. Anything sent directly to the factory by
                mistake is unrecoverable — no admin exists to rescue it.
              </Text>
              <HStack spacing="md">
                <Link
                  fontSize="sm"
                  href={`https://base-sepolia.blockscout.com/address/${WRAPPER_FACTORY}`}
                  isExternal
                >
                  Factory on Blockscout ↗
                </Link>
                <Link fontSize="sm" href="/mint">
                  First: mint a token →
                </Link>
                <Link fontSize="sm" href="/create">
                  Then: create a pool →
                </Link>
              </HStack>
            </VStack>
          </Card>

          <TokenSelectModal
            chain={GqlChainValues.BaseSepolia}
            finalFocusRef={tokenSelectBtn}
            isOpen={tokenSelectDisclosure.isOpen}
            onClose={tokenSelectDisclosure.onClose}
            onOpen={tokenSelectDisclosure.onOpen}
            onTokenSelect={token => {
              setUnderlying(token.address)
              setUnderlyingLabel(`${token.symbol} — ${token.name}`)
              tokenSelectDisclosure.onClose()
            }}
            pinNativeAsset
            tokens={tokens}
          />
        </TokenBalancesProvider>
      </VStack>
    </DefaultPageContainer>
  )
}
