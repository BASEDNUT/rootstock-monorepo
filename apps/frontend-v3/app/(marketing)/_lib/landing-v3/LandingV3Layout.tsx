import { Hero } from './Hero'
import { Code } from './Code'
import { Contracts } from './Contracts'
import { Features } from './Features'
import { BuildPromo } from '@repo/lib/shared/pages/PoolsPage/BuildPromo'
import Noise from '@repo/lib/shared/components/layout/Noise'

export function LandingV3Layout() {
  return (
    <>
      <Hero />
      <Code />
      <Contracts />
      <Features />
      <Noise backgroundColor="background.level0WithOpacity">
        <BuildPromo />
      </Noise>
    </>
  )
}
