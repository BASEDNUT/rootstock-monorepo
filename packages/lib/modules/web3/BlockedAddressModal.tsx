'use client'

import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  Text,
} from '@chakra-ui/react'
import { useEffect } from 'react'
import { useUserAccount } from './UserAccountProvider'

export function BlockedAddressModal() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isBlocked } = useUserAccount()

  useEffect(() => {
    if (isBlocked) onOpen()
  }, [isBlocked])

  return (
    <Modal isCentered isOpen={isOpen} onClose={onClose} preserveScrollBarGap>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Address blocked</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text color="grayText" mb="md">
            Your address was flagged by a third-party risk service and has been disconnected from
            this interface. The check is advisory only — it never blocks a transaction, and every
            transaction is signed in your own wallet.
          </Text>
          <Text color="grayText" mb="md">
            This website is open source and permissionless. Anyone can fork and run their own front
            end.
          </Text>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
