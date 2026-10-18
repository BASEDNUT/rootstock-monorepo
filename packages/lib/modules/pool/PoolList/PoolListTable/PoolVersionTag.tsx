import { Center, Image } from '@chakra-ui/react'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { CowIcon } from '@repo/lib/shared/components/icons/logos/CowIcon'
import { isCowAmmPool } from '../../pool.helpers'
import { PoolListItem } from '../../pool.types'
import { Pool } from '../../pool.types'
import { TooltipWithTouch } from '@repo/lib/shared/components/tooltips/TooltipWithTouch'

/**
 * Brand mark in the pools table Details cell. ROOTSTOCK has a single
 * protocol version — the badge shows the nut mark, never a version number.
 * CoW AMM pools keep their own icon.
 */
export function PoolVersionTag({
  pool,
  isSmall,
}: {
  pool: Pick<PoolListItem | Pool, 'protocolVersion' | 'type'>
  isSmall?: boolean
}) {
  const isCow = isCowAmmPool(pool.type)
  const size = isSmall ? '6' : '7'

  return (
    <TooltipWithTouch label={isCow ? 'CoW AMM' : 'ROOTSTOCK'}>
      <BalBadge
        color="font.secondary"
        cursor="default"
        fontSize="xs"
        h={size}
        p="0"
        textTransform="lowercase"
        w={size}
      >
        <Center h="full" w="full">
          {isCow ? (
            <CowIcon size={18} />
          ) : (
            <Image
              alt="ROOTSTOCK"
              height={16}
              ignoreFallback
              src="/images/icons/nut.svg"
              width={16}
            />
          )}
        </Center>
      </BalBadge>
    </TooltipWithTouch>
  )
}
