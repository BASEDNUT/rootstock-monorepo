/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { Box, Button, Center, Heading, Image, Stack, Text, VStack, Link } from '@chakra-ui/react'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { motion, useInView } from 'motion/react'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { ArrowUpRight } from 'lucide-react'

// @ts-ignore
import { SoilBg } from './shared/SoilBg'
import { useRef } from 'react'
import { WordsPullUp } from '@repo/lib/shared/components/animations/WordsPullUp'
import { MotionButtonProps } from './types'

const MotionText = motion(Text)
const MotionHeading = motion(Heading)
const MotionButton = motion(Button) as React.FC<MotionButtonProps>

export function Hero() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <Noise position="relative">
      <Box bottom={0} h="100vh" left={0} minH="600px" position="absolute" right={0} top={0}>
        <SoilBg />
      </Box>

      {/* Orbital-root hero artwork — foreground overlay, right-anchored, masked
          fade toward the left so the headline stays readable (Boss 2026-10-01).
          The seed core is the root of the orbital liquidity network. */}
      <Box
        maxW="1150px"
        opacity={{ base: 0.4, md: 0.72, xl: 0.82 }}
        pointerEvents="none"
        position="absolute"
        right={{ base: '-45%', md: '-12%', xl: '-4%' }}
        sx={{
          maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.25) 12%, black 34%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, rgba(0,0,0,.25) 12%, black 34%)',
        }}
        top="50%"
        transform="translateY(-50%)"
        w={{ base: '115vw', md: '68vw', xl: '58vw' }}
        zIndex={1}
      >
        <Image
          alt=""
          h="auto"
          htmlHeight="941"
          htmlWidth="1672"
          src="/images/landing/rootstock-orbital-root.webp"
          w="full"
        />
      </Box>

      <DefaultPageContainer
        flex="1"
        h="100vh"
        minH="600px"
        noVerticalPadding
        position="relative"
        zIndex={2}
      >
        <Center h="full" justifyContent="start" ref={ref}>
          <VStack alignItems="start" spacing="xl">
            <MotionText
              animate={
                isInView
                  ? {
                      opacity: 1,
                      filter: 'blur(0px)',
                      willChange: 'opacity, filter',
                    }
                  : {}
              }
              background="font.special"
              backgroundClip="text"
              fontSize="sm"
              initial={{ opacity: 0, filter: 'blur(3px)' }}
              transition={{ delay: 0.7, duration: 0.3, delayChildren: 0.5, ease: 'easeInOut' }}
              variant="eyebrow"
            >
              ROOTSTOCK · TESTNET LIVE
            </MotionText>

            <WordsPullUp
              as="h1"
              color="font.primary"
              delay={0.7}
              flexWrap="wrap"
              fontSize={{ base: '4xl', md: '6xl' }}
              fontWeight="bold"
              letterSpacing="-2px"
              lineHeight={1}
              maxW="100%"
              pr="2"
              text="Custom markets made simple"
            />
            <MotionHeading
              animate={
                isInView
                  ? {
                      opacity: 1,
                      y: 0,
                      filter: 'blur(0px)',
                      willChange: 'transform, opacity, filter',
                    }
                  : {}
              }
              as="h2"
              color="font.secondary"
              fontSize={{ base: 'xl', md: '2xl' }}
              fontWeight="thin"
              initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
              maxW="700px"
              transition={{ duration: 1, delay: 0.9, ease: 'easeInOut' }}
              w="full"
            >
              Swap, provide liquidity, or build markets with flexible onchain infrastructure.
            </MotionHeading>
            <MotionText
              animate={isInView ? { opacity: 1 } : {}}
              color="font.secondary"
              fontSize="md"
              initial={{ opacity: 0 }}
              maxW="700px"
              transition={{ duration: 1, delay: 1.1, ease: 'easeInOut' }}
            >
              One engine for pools, hooks, and routing — giving users and developers the tools to
              create and interact with custom liquidity without unnecessary complexity.
            </MotionText>
            <Stack alignItems={{ base: 'start', md: 'center' }} direction="row" mt="0" spacing="ms">
              <MotionButton
                animate={
                  isInView
                    ? {
                        opacity: 1,
                        willChange: 'opacity',
                      }
                    : {}
                }
                as={Link}
                href="/swap"
                initial={{ opacity: 0 }}
                rightIcon={<ArrowUpRight size="14px" />}
                size="lg"
                transition={{ duration: 2, delay: 1.2 }}
                variant="primary"
              >
                Launch app
              </MotionButton>

              <MotionButton
                animate={
                  isInView
                    ? {
                        opacity: 1,
                        willChange: 'opacity',
                      }
                    : {}
                }
                as={Link}
                href="/create"
                initial={{ opacity: 0 }}
                rightIcon={<ArrowUpRight size="14px" />}
                size="lg"
                transition={{ duration: 2, delay: 1.2 }}
                variant="secondary"
              >
                Create a pool
              </MotionButton>
            </Stack>
          </VStack>
        </Center>
      </DefaultPageContainer>
      <Box
        bgGradient="linear(transparent 0%, background.level0 50%, transparent 100%)"
        bottom="0"
        h="200px"
        left="0"
        mb="-100px"
        position="absolute"
        w="full"
      />
    </Noise>
  )
}
