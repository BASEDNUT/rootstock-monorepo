import { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: 'ROOTSTOCK DeFi Liquidity Bootstrapping Pool Creation',
  description: `
    Create a new liquidity bootstrapping pool on ROOTSTOCK.
  `,
}

export default async function Layout({ children }: PropsWithChildren) {
  return <>{children}</>
}
