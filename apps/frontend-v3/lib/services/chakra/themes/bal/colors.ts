import { colors as baseColors } from '@repo/lib/shared/services/chakra/themes/base/colors'

// BASED NUT brand pass — peanut-caramel identity ramp.
// Ramp keys are kept ('purple') so every semantic/component reference propagates without structural edits.
const caramel = {
  '50': '#fefaf4',
  '100': '#fcf5eb',
  '200': '#faedda',
  '300': '#f5d7ae',
  '400': '#f0ca95',
  '500': '#e8b36a',
  '600': '#dda04a',
  '700': '#c98d38',
  '800': '#a9762e',
  '900': '#8a6128',
  '950': '#5e4017',
}

export const colors = {
  ...baseColors,
  purple: caramel,
  base: {
    light: 'background.level1',
    hslLight: '44,22%,90%',
    dark: 'hsla(26,12%,25%,1)',
    hslDark: '26,12%,25%',
  },
  gradient: {
    ...baseColors.gradient,
    // honey dawn — same stop rhythm as balancer's dawn gradients, warm hues only
    dawnLight:
      'linear-gradient(45deg, hsla(38, 89%, 74%, 1) 0%, hsla(33, 72%, 70%, 1) 40%, hsla(20, 78%, 66%, 1) 100%)',
    dawnLightAlpha15:
      'linear-gradient(45deg, hsla(38, 89%, 74%, 0.15) 0%, hsla(33, 72%, 70%, 0.15) 40%, hsla(20, 78%, 66%, 0.15) 100%)',
    dawnDark:
      'linear-gradient(135deg, hsla(40, 80%, 78%, 1) 0%, hsla(33, 62%, 72%, 1) 40%, hsla(26, 48%, 68%, 1) 60%, rgb(224, 164, 98) 100%, rgb(230, 150, 62) 140%)',
    dawnDarkAlpha15:
      'linear-gradient(45deg, hsla(40, 80%, 78%, 0.15) 0%, hsla(33, 62%, 72%, 0.15) 25%, hsla(26, 48%, 68%, 0.15) 50%, hsla(24, 78%, 64%, 0.15) 100%)',
    special:
      'linear-gradient(266.76deg, rgba(234, 168, 121, 0.5) -20.29%, rgba(232, 179, 106, 0.5) 45.08%, rgba(234, 168, 121, 0) 110.45%)',
  },
}

export const primaryTextColor = `linear-gradient(45deg, ${baseColors.gray['700']} 0%, ${baseColors.gray['500']} 100%)`
