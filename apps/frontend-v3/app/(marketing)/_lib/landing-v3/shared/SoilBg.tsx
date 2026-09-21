'use client'

import { Box } from '@chakra-ui/react'

// ROOTSTOCK soil background — drawn, no photo.
// Dark warm-earth gradient with a low green glow at the base (orchard-terminal palette)
// and faint cream root line-art. Calm texture, zen preserved.
export function SoilBg() {
  return (
    <Box
      bottom={0}
      h="full"
      left={0}
      position="absolute"
      right={0}
      top={0}
      w="full"
      sx={{
        background:
          'radial-gradient(circle at 50% 115%, rgba(127, 159, 99, 0.16) 0%, transparent 55%), linear-gradient(180deg, #17110c 0%, #1d150f 45%, #251b13 100%)',
      }}
    >
      <Box
        bottom={0}
        h="full"
        left={0}
        opacity={0.14}
        position="absolute"
        right={0}
        top={0}
        w="full"
        sx={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 900 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23c9ab7e' stroke-width='1.1'%3E%3Cpath d='M450 620 C440 500 380 430 300 380 C240 342 170 330 90 340'/%3E%3Cpath d='M450 620 C465 490 540 420 620 370 C690 328 770 330 840 355' opacity='.7'/%3E%3Cpath d='M450 620 C452 520 448 430 445 330 C443 250 447 170 440 90' opacity='.5'/%3E%3Cpath d='M300 380 C310 330 290 280 240 250' opacity='.6'/%3E%3Cpath d='M620 370 C610 320 630 270 680 245' opacity='.6'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      />
      <Box
        bottom={0}
        h="full"
        left={0}
        opacity={0.1}
        position="absolute"
        right={0}
        top={0}
        w="full"
        sx={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E")`,
        }}
      />
    </Box>
  )
}
