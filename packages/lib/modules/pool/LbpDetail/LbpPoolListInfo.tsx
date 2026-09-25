import { HStack, Text } from '@chakra-ui/react'
import { PoolListItem } from '../pool.types'
import { differenceInDays, differenceInHours, isAfter, secondsToMilliseconds } from 'date-fns'
import { now } from '@repo/lib/shared/utils/time'
import { Clock } from 'lucide-react'

type Props = {
  pool: PoolListItem
}

export function LbpPoolListInfo({ pool }: Props) {
  const startTime = secondsToMilliseconds(pool.lbpParams?.startTime || 0)
  const endTime = secondsToMilliseconds(pool.lbpParams?.endTime || 0)
  // S100b audit fix F3 (2026-09-23): baked/onchain pools carry no lbpParams.
  // Guard against epoch-0 math that rendered 'Starts: -497283h' on LBP rows
  // in the static export (browser-verified defect). No real start time →
  // render nothing rather than a garbage countdown.
  if (!startTime) return null
  const hasStarted = startTime && isAfter(now(), startTime)
  const hasEnded = endTime && isAfter(now(), endTime)

  if (!hasStarted) {
    const hoursDiff = differenceInHours(startTime, now())
    const daysDiff = differenceInDays(startTime, now())

    return (
      <HStack gap="xs" textColor="green.500">
        <Clock size="12" />
        <Text color="green.500" fontSize="xs">
          Starts: {hoursDiff < 24 ? `${hoursDiff}h` : `${daysDiff}d`}
        </Text>
      </HStack>
    )
  } else if (hasStarted && !hasEnded) {
    const hoursDiff = differenceInHours(endTime, now())
    const daysDiff = differenceInDays(endTime, now())

    return (
      <HStack gap="xs" textColor="font.warning">
        <Clock size="12" />
        <Text color="font.warning" fontSize="xs">
          Ends: {hoursDiff < 24 ? `${hoursDiff}h` : `${daysDiff}d`}
        </Text>
      </HStack>
    )
  } else {
    return (
      <HStack gap="xs" textColor="font.error">
        <Clock size="12" />
        <Text color="font.error" fontSize="xs">
          Ended
        </Text>
      </HStack>
    )
  }
}
