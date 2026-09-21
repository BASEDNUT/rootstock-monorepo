import { ThemeTypings, extendTheme } from '@chakra-ui/react'
import { colors, primaryTextColor } from './colors'
import { getNutTokens } from './nut-tokens'
import { getComponents } from '@repo/lib/shared/services/chakra/themes/base/components'
import { fonts, styles } from '@repo/lib/shared/services/chakra/themes/base/foundations'
import { getSemanticTokens } from '@repo/lib/shared/services/chakra/themes/base/semantic-tokens'
import { proseTheme } from '@repo/lib/shared/services/chakra/themes/base/prose'

const tokens = getNutTokens(colors, primaryTextColor)
const components = getComponents(tokens, primaryTextColor)
const semanticTokens = getSemanticTokens(tokens, colors)

// BASED NUT brand pass — honey glow on primary buttons instead of violet
const primaryButton = (components as any).Button?.variants?.primary
if (primaryButton) {
  primaryButton.boxShadow = '0 3px 20px hsla(38, 68%, 70%, 0.35)'
  primaryButton._hover = {
    ...primaryButton._hover,
    boxShadow: '0 3px 20px hsla(26, 80%, 60%, 0.45)',
  }
}

export const balTheme = {
  fonts,
  styles,
  colors,
  semanticTokens,
  components,
}

export const theme = extendTheme(balTheme, proseTheme) as ThemeTypings
