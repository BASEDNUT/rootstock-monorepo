'use client'

import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  HStack,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowUpRight } from 'lucide-react'
import NextLink from 'next/link'
import { BalancerIconCircular } from '@repo/lib/shared/components/icons/logos/BalancerIconCircular'
import { CowIconCircular } from '@repo/lib/shared/components/icons/logos/CowIconCircular'
import { FormSubsection } from '@repo/lib/shared/components/inputs/FormSubsection'
import {
  COW_PROTOCOL_ID,
  BALANCER_PROTOCOL_ID,
} from '@repo/lib/modules/pool/actions/create/constants'

const CREATE_POOL_LINKS = [
  {
    label: 'ROOTSTOCK',
    href: `/create?protocol=${BALANCER_PROTOCOL_ID.toLowerCase()}`,
    icon: <BalancerIconCircular size={24} />,
  },
  {
    label: 'CoW AMM',
    href: `/create?protocol=${COW_PROTOCOL_ID.toLowerCase()}`,
    icon: <CowIconCircular size={24} />,
  },
]

const RESOURCE_LINKS = [
  {
    label: 'Code & contracts',
    href: 'https://github.com/BASEDNUT/rootstock-monorepo',
  },
  {
    label: 'Audits',
    href: 'https://github.com/BASEDNUT/rootstock-monorepo/audits',
  },
  {
    label: 'Pools & data',
    href: 'https://terminal.basednut.com',
  },
]

type MobileBuildAccordionProps = {
  onClose?: () => void
}

export function MobileBuildAccordion({ onClose }: MobileBuildAccordionProps) {
  return (
    <Accordion allowToggle w="full">
      <AccordionItem border="none">
        <AccordionButton _hover={{ bg: 'transparent' }} pt="sm" px="0">
          <Text flex="1" fontSize="xl" fontWeight="medium" textAlign="left">
            Build
          </Text>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb="0" pt="0" px="0">
          <FormSubsection mx="0" py="0">
            <VStack align="start" spacing="md">
              {/* Create a pool section */}
              <VStack align="start" spacing="sm" w="full">
                <Text color="grayText" fontSize="sm" fontWeight="bold">
                  Create a pool
                </Text>
                {CREATE_POOL_LINKS.map(link => (
                  <Link
                    _hover={{ color: 'font.highlight', textDecoration: 'none' }}
                    as={NextLink}
                    href={link.href}
                    key={link.label}
                    onClick={onClose}
                    pb="0.5"
                    role="group"
                    w="full"
                  >
                    <HStack spacing="sm">
                      {link.icon}
                      <Text
                        _groupHover={{ color: 'font.highlight' }}
                        alignItems="center"
                        display="flex"
                        fontSize="md"
                        fontWeight="bold"
                        gap="xs"
                      >
                        {link.label}
                      </Text>
                    </HStack>
                  </Link>
                ))}
              </VStack>

              {/* Builder resources section */}
              <VStack align="start" spacing="sm" w="full">
                <Text color="grayText" fontSize="sm" fontWeight="bold">
                  Builder resources
                </Text>
                {RESOURCE_LINKS.map(link => (
                  <Link
                    _hover={{ color: 'font.highlight', textDecoration: 'none' }}
                    alignItems="center"
                    color="font.primary"
                    display="flex"
                    fontSize="xs"
                    gap="xxs"
                    href={link.href}
                    isExternal
                    key={link.label}
                    onClick={onClose}
                  >
                    {link.label}
                    <Box color="grayText">
                      <ArrowUpRight size={12} />
                    </Box>
                  </Link>
                ))}
              </VStack>
            </VStack>
          </FormSubsection>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  )
}
