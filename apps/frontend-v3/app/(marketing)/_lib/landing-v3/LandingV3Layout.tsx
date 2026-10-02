import { Hero } from './Hero'
import { Grow } from './Grow'
import { AtAGlance } from './AtAGlance'
import { CodeStack } from './CodeStack'
import { Code } from './Code'
import { Features } from './Features'
import { BuildPromo } from '@repo/lib/shared/pages/PoolsPage/BuildPromo'
import Noise from '@repo/lib/shared/components/layout/Noise'

export function LandingV3Layout() {
  return (
    <>
      <Hero />
      <Grow />
      <AtAGlance />
      <CodeStack />
      <Code />
      <Features />
      <Noise backgroundColor="background.level0WithOpacity">
        <BuildPromo />
      </Noise>
    </>
  )
}
