'use client'

import { Button, HStack, IconButton, useDisclosure, Text } from '@chakra-ui/react'
import { ChevronLeftIcon } from '@chakra-ui/icons'
import { useLbpForm } from './LbpFormProvider'
import { LbpCreationModal } from './modal/LbpCreationModal'
import { useRef } from 'react'
import { useUserAccount } from '../web3/UserAccountProvider'
import { ConnectWallet } from '../web3/ConnectWallet'
import { useCopyToClipboard } from '@repo/lib/shared/hooks/useCopyToClipboard'
import { useFormState, useWatch } from 'react-hook-form'
import { isDeploymentReadyChain } from '@repo/lib/modules/pool/onchain-pool-discovery'

export function LbpFormAction() {
  const { isConnected } = useUserAccount()

  const {
    isLastStep,
    isFirstStep,
    goToNextStep,
    goToPreviousStep,
    saleStructureForm,
    projectInfoForm,
    validateCurrentStep,
    poolAddress,
  } = useLbpForm()

  const selectedChain = useWatch({ control: saleStructureForm.control, name: 'selectedChain' })

  // S110 (Boss 2026-09-30): ROOTSTOCK launchpad factories exist only where
  // OUR stack is deployed — honest gate until the mainnet release.
  // S114b: isDeploymentReadyChain widens readiness under the E2E fork gate
  // (fork builds run against upstream's Ethereum deployment).
  const rootstockChainReady = isDeploymentReadyChain(selectedChain)
  const previewModalDisclosure = useDisclosure()
  const nextBtn = useRef(null)
  const { copyToClipboard, isCopied } = useCopyToClipboard()
  const saleFormState = useFormState({ control: saleStructureForm.control })
  const projectFormState = useFormState({ control: projectInfoForm.control })
  const isFormStateValid = saleFormState.isValid && projectFormState.isValid

  if (!isConnected) return <ConnectWallet variant="primary" w="full" />

  const formButtonText = isLastStep ? `${poolAddress ? 'Initialize' : 'Create'} LBP` : 'Next'
  const initializeUrl = `${window.location.origin}/lbp/create/${selectedChain}/${poolAddress}`

  return (
    <HStack spacing="md" w="full">
      {!isFirstStep && (
        <IconButton
          aria-label="Back"
          icon={<ChevronLeftIcon h="8" w="8" />}
          onClick={goToPreviousStep}
          size="lg"
        />
      )}

      {poolAddress && (
        <Button
          onClick={() => copyToClipboard(initializeUrl)}
          size="lg"
          variant="secondary"
          w="full"
        >
          {isCopied ? 'Copied ✓' : 'Copy Link'}
        </Button>
      )}

      <Button
        disabled={!rootstockChainReady}
        onClick={async () => {
          const isStepValid = await validateCurrentStep()
          if (!isStepValid) return

          if (isLastStep) {
            previewModalDisclosure.onOpen()
          } else {
            goToNextStep()
          }
        }}
        size="lg"
        variant="primary"
        w="full"
      >
        {formButtonText}
      </Button>

      {!rootstockChainReady && (
        <Text color="font.secondary" fontSize="sm" w="full">
          ROOTSTOCK launchpad factories deploy with the Rootstock mainnet release — Base Sepolia is
          live now.
        </Text>
      )}

      {isFormStateValid && isLastStep && (
        <LbpCreationModal
          finalFocusRef={nextBtn}
          isOpen={previewModalDisclosure.isOpen}
          onClose={previewModalDisclosure.onClose}
          onOpen={previewModalDisclosure.onOpen}
        />
      )}
    </HStack>
  )
}
