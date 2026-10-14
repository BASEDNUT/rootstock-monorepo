'use client'

import { fadeIn } from '@repo/lib/shared/utils/animations'
import { NutLogo } from '../imgs/NutLogo'
import { NutLogoType } from '../imgs/NutLogoType'
import { Box, Link } from '@chakra-ui/react'
import { motion } from 'motion/react'
import NextLink from 'next/link'

export function NavLogo() {
  return (
    <Box as={motion.div} variants={fadeIn}>
      <Link as={NextLink} href="/" prefetch variant="nav">
        <Box>
          <Box display={{ base: 'block', md: 'none' }}>
            <NutLogo width="26px" />
          </Box>
          <Box display={{ base: 'none', md: 'block' }}>
            <NutLogoType width="120px" />
          </Box>
        </Box>
      </Link>
    </Box>
  )
}
