import { Button, HStack, IconButton, useDisclosure, Divider, VStack, Text } from '@chakra-ui/react'
import { ChevronLeftIcon } from '@chakra-ui/icons'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { ConnectWallet } from '@repo/lib/modules/web3/ConnectWallet'
import { usePoolCreationForm } from './PoolCreationFormProvider'
import { PoolCreationModal } from './modal/PoolCreationModal'
import { useRef, useEffect } from 'react'
import { InvalidTotalWeightAlert } from './InvalidTotalWeightAlert'
import { useCopyToClipboard } from '@repo/lib/shared/hooks/useCopyToClipboard'
import { isAutoRangePool, isCowPool } from './helpers'
import { useFormState, useWatch } from 'react-hook-form'
import { isDeploymentReadyChain } from '@repo/lib/modules/pool/onchain-pool-discovery'

export function PoolCreationFormAction({ disabled }: { disabled?: boolean }) {
  const { poolAddress, poolCreationForm, goToNextStep, goToPreviousStep, isLastStep, isFirstStep } =
    usePoolCreationForm()

  const [poolTokens, poolType, network] = useWatch({
    control: poolCreationForm.control,
    name: ['poolTokens', 'poolType', 'network'],
  })

  const formState = useFormState({ control: poolCreationForm.control })
  const previewModalDisclosure = useDisclosure()
  const { isConnected } = useUserAccount()
  const nextBtn = useRef(null)
  const { copyToClipboard, isCopied } = useCopyToClipboard()

  const hasTokenAmounts = poolTokens.every(token => token.amount)

  // S110 (Boss 2026-09-30): ROOTSTOCK factories exist only where OUR stack
  // is deployed — creating through upstream's Base deployment would put
  // funds in pools that are not ROOTSTOCK. Honest gate until mainnet.
  // S114b: isDeploymentReadyChain widens readiness under the E2E fork gate
  // (fork builds run against upstream's Ethereum deployment).
  const rootstockChainReady = isDeploymentReadyChain(network)

  useEffect(() => {
    // trigger modal close if AutoRange and token amounts have not been set
    if (poolAddress && isAutoRangePool(poolType) && !hasTokenAmounts) {
      previewModalDisclosure.onClose()
    }
  }, [poolAddress, poolType, hasTokenAmounts])

  if (!isConnected) return <ConnectWallet variant="primary" w="full" />

  const showBackButton = !isFirstStep && !poolAddress

  const initializeUrl = `${window.location.origin}/create/${network}/${poolType}/${poolAddress}`

  return (
    <>
      <VStack spacing="lg" w="full">
        <Divider />

        <InvalidTotalWeightAlert />

        <HStack spacing="md" w="full">
          {showBackButton && (
            <IconButton
              aria-label="Back"
              icon={<ChevronLeftIcon h="8" w="8" />}
              onClick={goToPreviousStep}
              size="lg"
            />
          )}

          {poolAddress && !isCowPool(poolType) && (
            <Button
              onClick={() => copyToClipboard(initializeUrl)}
              size="lg"
              variant="secondary"
              w="full"
            >
              {isCopied ? 'Copied ✓' : 'Copy Link'}
            </Button>
          )}

          {isLastStep ? (
            <Button
              disabled={disabled || !rootstockChainReady}
              onClick={previewModalDisclosure.onOpen}
              size="lg"
              variant="primary"
              w="full"
            >
              {poolAddress ? 'Initialize Pool' : 'Create Pool'}
            </Button>
          ) : (
            <Button disabled={disabled} onClick={goToNextStep} size="lg" variant="primary" w="full">
              Next
            </Button>
          )}
        </HStack>

        {!rootstockChainReady && (
          <Text color="font.secondary" fontSize="sm" w="full">
            ROOTSTOCK pool factories deploy with the Rootstock mainnet release — Base Sepolia is
            live now.
          </Text>
        )}
      </VStack>

      {formState.isValid && isLastStep && (
        <PoolCreationModal
          finalFocusRef={nextBtn}
          isOpen={previewModalDisclosure.isOpen}
          onClose={previewModalDisclosure.onClose}
          onOpen={previewModalDisclosure.onOpen}
        />
      )}
    </>
  )
}
