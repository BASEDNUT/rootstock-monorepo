import { getTokens } from '@repo/lib/shared/services/chakra/themes/base/tokens'

// BASED NUT brand pass — warm dark elevation ladder.
// Exact hue swap 216° → 26° at identical saturation/lightness:
// balancer's zen lightness rhythm is preserved, only the temperature changes.
export function getNutTokens(colors: any, primaryTextColor: string) {
  const baseTokens = getTokens(colors, primaryTextColor)

  return {
    ...baseTokens,
    colors: {
      ...baseTokens.colors,
      dark: {
        ...baseTokens.colors.dark,
        background: {
          ...baseTokens.colors.dark.background,
          level0: '#3f3731',
          level1: '#473e38',
          level2: '#50463f',
          level3: '#584e46',
          level4: '#61554c',
          level0WithOpacity: 'rgba(63, 55, 49, 0.96)',
        },
        border: {
          ...baseTokens.colors.dark.border,
          base: '#61554c',
          divider: '#2d241c',
          zen: 'rgba(97, 85, 76, 0.50)',
        },
        text: {
          ...baseTokens.colors.dark.text,
          secondary: '#c0aea0',
          secondaryGradient: 'linear-gradient(45deg, #c0aea0 0%, #9d8d80 100%)',
        },
        input: {
          ...baseTokens.colors.dark.input,
          borderDefault: '#6a5d53',
        },
      },
    },
  }
}
