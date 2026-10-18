import { Center, Text } from '@chakra-ui/react'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { CowIcon } from '@repo/lib/shared/components/icons/logos/CowIcon'
import { isCowAmmPool } from '../../pool.helpers'
import { PoolListItem } from '../../pool.types'
import { Pool } from '../../pool.types'
import { TooltipWithTouch } from '@repo/lib/shared/components/tooltips/TooltipWithTouch'

/**
 * Version tag for CoW AMM pools only. ROOTSTOCK has a single protocol version —
 * no version badge is rendered for standard pools.
 */
export function PoolVersionTag({
  pool,
  isSmall,
}: {
  pool: Pick<PoolListItem | Pool, 'protocolVersion' | 'type'>
  isSmall?: boolean
}) {
  const isCow = isCowAmmPool(pool.type)
  if (!isCow) return null

  const size = isSmall ? '6' : '7'

  return (
    <TooltipWithTouch label="CoW AMM">
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
          <Text
            _groupHover={{
              fontWeight: 'medium',
              background: 'auto',
              color: 'font.maxContrast',
              backgroundClip: 'unset',
            }}
            background="auto"
            backgroundClip="unset"
            fontSize="xs"
            fontWeight="medium"
            transition="all 0.2s var(--ease-out-cubic)"
            zIndex={1}
          >
            <CowIcon size={18} />
          </Text>
        </Center>
      </BalBadge>
    </TooltipWithTouch>
  )
}
