import { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: 'ROOTSTOCK DeFi Liquidity Pool Creation',
  description: `
    Create a new DeFi liquidity pool on ROOTSTOCK.
  `,
}

export default async function Layout({ children }: PropsWithChildren) {
  return <>{children}</>
}
