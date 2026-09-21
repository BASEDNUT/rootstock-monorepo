import { Metadata } from 'next'
import { satoshiFont } from '@repo/lib/assets/fonts/satoshi/satoshi'
import NextTopLoader from 'nextjs-toploader'
import { SpeedInsights } from '@vercel/speed-insights/next'
import '@repo/lib/assets/css/global.css'
import { PropsWithChildren } from 'react'
import { Providers } from '@repo/lib/shared/components/site/providers'
import { NavBarContainer } from '@bal/lib/components/navs/NavBarContainer'
import { ThemeProvider } from '@bal/lib/services/chakra/ThemeProvider'
import { NutLogoType } from '@bal/lib/components/imgs/NutLogoType'
import { Footer } from '@repo/lib/shared/components/navs/Footer'

export const metadata: Metadata = {
  title: `ROOTSTOCK—DeFi Liquidity Pools`,
  description: `Explore liquidity pools on ROOTSTOCK and earn passively in yield-bearing pools.`,
  icons: [
    { rel: 'icon', type: 'image/x-icon', url: '/favicon.ico' },
    {
      rel: 'icon',
      type: 'image/png',
      url: '/favicon-light.png',
      media: '(prefers-color-scheme: light)',
    },
    {
      rel: 'icon',
      type: 'image/png',
      url: '/favicon-dark.png',
      media: '(prefers-color-scheme: dark)',
    },
  ],
  openGraph: {
    title: `ROOTSTOCK—DeFi Liquidity Pools`,
    description: `Explore liquidity pools on ROOTSTOCK and earn passively in yield-bearing pools.`,
    siteName: 'ROOTSTOCK',
    type: 'website',
  },
  other: {
    'base:app_id': '6a030a6b0ec9a0da335752af',
  },
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body
        className={satoshiFont.className}
        style={{ marginRight: '0px !important' }} // Required to prevent layout shift introduced by Rainbowkit
      >
        <NextTopLoader color="#e8b36a" showSpinner={false} />
        <ThemeProvider>
          <Providers>
            <NavBarContainer />
            {children}
            <Footer
              logoType={<NutLogoType />}
              subTitle="Battle-tested AMM engineering, forked and grown."
              title="Custom markets made simple"
            />
            <SpeedInsights />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
