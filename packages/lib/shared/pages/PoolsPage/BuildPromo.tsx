'use client'

import { Box, Button, Center, Flex, Heading, Link, Text, HStack, Stack } from '@chakra-ui/react'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import NextLink from 'next/link'
import { RadialPattern } from '../../components/zen/RadialPattern'

export function BuildPromo() {
  return (
    <Box overflow="hidden" pb="64px" position="relative" pt={{ base: '200px', md: '220px' }}>
      <Box zIndex="-1">
        <RadialPattern
          bottom="-900px"
          circleCount={14}
          height={1400}
          innerHeight={150}
          innerWidth={150}
          left="calc(50% - 700px)"
          position="absolute"
          width={1400}
        />
      </Box>
      <Center>
        <FadeInOnView animateOnce={false}>
          <Flex direction="column" gap="lg" textAlign="center">
            <Stack alignItems="center" gap="md" px="md" width="full">
              <Heading
                as="h2"
                backgroundClip="text"
                bg="background.special"
                display="flex"
                justifyContent="center"
                pb="0.5"
                size="lg"
                width="full"
              >
                Build something new
              </Heading>
              <Text
                color="font.secondary"
                display="flex"
                justifyContent="center"
                lineHeight="1.4"
                maxWidth="38ch"
                sx={{ textWrap: 'pretty' }}
                textAlign="center"
                width="full"
              >
                Start by creating your own pool — weighted, stable, or a launch pool. Or prototype
                a custom AMM on the engine.
              </Text>
            </Stack>
            <Flex
              display="flex"
              gap="ms"
              justifyContent="center"
              margin="0 auto"
              maxWidth={356}
              width="full"
            >
              <Button as={NextLink} flex={1} href="/create" size="lg" variant="primary">
                Create a pool
              </Button>
              <Button
                as={NextLink}
                flex={1}
                href="https://terminal.basednut.com"
                size="lg"
                variant="tertiary"
              >
                Explore pools
              </Button>
            </Flex>
            
          </Flex>
        </FadeInOnView>
      </Center>
    </Box>
  )
}
