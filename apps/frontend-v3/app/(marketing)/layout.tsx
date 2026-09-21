import { Box } from '@chakra-ui/react'
import { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: `ROOTSTOCK—Custom markets made simple`,
  description: `A programmable liquidity engine for custom markets — pools, hooks, and routing in one core.`,
  openGraph: {
    title: `ROOTSTOCK—Custom markets made simple`,
    description: `DeFi's most extensive AMM product suite. The Balancer protocol delivers fungible and yield-bearing liquidity across Ethereum and select EVM chains.`,
    siteName: 'ROOTSTOCK',
  },
}

export default function MarketingLayout({ children }: PropsWithChildren) {
  return <Box>{children}</Box>
}
