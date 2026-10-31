import { memo, useMemo, useState } from 'react'
import { HStack, Heading, Skeleton, VStack } from '@chakra-ui/react'
import { TokenIconStack } from '../../../../tokens/TokenIconStack'
import { TokenStackPopover } from '../../../../tokens/TokenStackPopover'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { usePool } from '../../../PoolProvider'
import MainAprTooltip from '@repo/lib/shared/components/tooltips/apr-tooltip/MainAprTooltip'
import { isCowAmmPool } from '../../../pool.helpers'
import { useGetPoolRewards } from '../../../useGetPoolRewards'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import { LabelWithTooltip } from '@repo/lib/shared/components/tooltips/LabelWithTooltip'
import { PoolTotalLiquidityDisplay } from '../../PoolTotalLiquidityDisplay'
import { poolMetricDisplay } from '@repo/lib/modules/pool/pool-metrics'
import ButtonGroup, {
  type ButtonGroupOption,
} from '@repo/lib/shared/components/btns/button-group/ButtonGroup'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { useOnchainYieldWindows } from '../../../onchain-yield-windows.hook'
import { fNum } from '@repo/lib/shared/utils/numbers'

type PoolStatsValues = {
  totalLiquidity: string
  volumeWindow: string
  incomeWindow: string
  weeklyRewards: string
}

const MemoizedMainAprTooltip = memo(MainAprTooltip)

const WINDOW_OPTIONS: ButtonGroupOption[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: 'lifetime', label: 'Lifetime' },
]

function windowLabelShort(value: string): string {
  if (value === '24h') return '24h'
  if (value === 'lifetime') return 'Lifetime'
  return '7d'
}

function windowAprTooltip(value: string): string {
  if (value === '24h') {
    return 'Annualized swap-fee APR over the trailing 24 hours: fees(24h) x 365 / TVL. One busy day dominates this number - see the 7d window for the smoother projection.'
  }

  if (value === '7d') {
    return 'Projected APR from the trailing 7 days: fees(7d) x 365 / 7 / TVL. Fees stay in the pool, so LPs compound automatically.'
  }

  return "Annualized over the pool's entire live history: lifetime fees x (365 / age in days) / TVL - the realized track record."
}

export function PoolSnapshotValues() {
  const { chain, pool, tvl, isLoading: isLoadingPool } = usePool()
  const { toCurrency } = useCurrency()

  const {
    tokens,
    weeklyRewards,
    weeklyRewardsByToken,
    isLoading: isLoadingTokens,
  } = useGetPoolRewards(pool)

  const isOnchainOnly = chain ? isOnchainOnlyNetwork(chain) : false

  // WINDOW_OPTIONS is a literal covered by noUncheckedIndexedAccess — non-null assert
  const [activeWindow, setActiveWindow] = useState<ButtonGroupOption>(WINDOW_OPTIONS[1]!)

  const decimalsByAddress = useMemo(() => {
    const out: Record<string, number> = {}

    for (const t of pool?.poolTokens || []) {
      out[t.address.toLowerCase()] = t.decimals
    }

    return out
  }, [pool?.poolTokens])

  const { data: yieldWindows, isLoading: isLoadingYield } = useOnchainYieldWindows(
    isOnchainOnly,
    chain,
    pool?.id,
    Number(tvl) || 0,
    Number(pool?.createTime) || 0,
    decimalsByAddress
  )

  const windowKey = activeWindow.value

  const selected =
    windowKey === '24h'
      ? yieldWindows?.w24h
      : windowKey === '7d'
        ? yieldWindows?.w7d
        : yieldWindows?.lifetime

  const isLifetime = windowKey === 'lifetime'
  const windowSuffix = windowLabelShort(windowKey)

  // onchain-only pools: the yield windows own volume/fees/APR truth per
  // window; other pools keep dynamicData (upstream behavior unchanged).
  const volumeDisplay =
    isOnchainOnly && selected
      ? selected.volumeUsd === null
        ? '—'
        : toCurrency(selected.volumeUsd, { abbreviated: false })
      : poolMetricDisplay(pool?.dynamicData.volume24h, v => toCurrency(v, { abbreviated: false }))

  const incomeDisplay =
    isOnchainOnly && selected
      ? selected.feesUsd === null
        ? '—'
        : toCurrency(selected.feesUsd, { abbreviated: false, noDecimals: true })
      : isCowAmmPool(pool.type)
        ? toCurrency(pool.dynamicData.surplus24h, { abbreviated: false, noDecimals: true })
        : poolMetricDisplay(pool.dynamicData.fees24h, v =>
            toCurrency(v, { abbreviated: false, noDecimals: true })
          )

  const aprDisplay =
    isOnchainOnly && selected && selected.apr !== null ? fNum('apr', selected.apr) : null

  const apyDisplay =
    isOnchainOnly && selected && selected.apy !== null ? fNum('apr', selected.apy) : null

  const poolStatsValues: PoolStatsValues | undefined = pool
    ? {
        totalLiquidity: toCurrency(tvl, { abbreviated: false }),
        volumeWindow: volumeDisplay,
        incomeWindow: incomeDisplay,
        weeklyRewards: weeklyRewards ? toCurrency(weeklyRewards.toString()) : 'N/A',
      }
    : undefined

  const incomeLabel = isCowAmmPool(pool.type) ? 'Surplus' : 'Swap fees'
  const showWindowChips = isOnchainOnly && !!yieldWindows

  return (
    <>
      {showWindowChips && (
        <HStack justify="flex-end" w="full">
          <ButtonGroup
            currentOption={activeWindow}
            groupId="pool-yield-window"
            onChange={setActiveWindow}
            options={WINDOW_OPTIONS}
            size="xxs"
          />
        </HStack>
      )}
      <FadeInOnView scaleUp={false}>
        <VStack align="flex-start" spacing="xxs" w="full">
          <LabelWithTooltip
            label="TVL"
            tooltip="The Total Value Locked (TVL) of the pool. This is the sum of the value of all the assets in the pool."
          />
          {isLoadingPool && !Number(tvl) ? (
            <Skeleton height="28px" w="100px" />
          ) : (
            <PoolTotalLiquidityDisplay
              size="h4"
              totalLiquidity={poolStatsValues?.totalLiquidity || ''}
            />
          )}
        </VStack>
      </FadeInOnView>
      <FadeInOnView scaleUp={false}>
        <VStack align="flex-start" spacing="xxs" w="full">
          <LabelWithTooltip
            label={isOnchainOnly ? `Swap vol (${windowSuffix})` : 'Swap vol (24h)'}
            tooltip={`The swap volume routing through this pool over the selected ${
              isLifetime ? 'live history' : `trailing ${windowSuffix}`
            }, from the onchain event ledger. Unlike the daily chart, this number always reflects the full selected window.`}
          />
          {poolStatsValues ? (
            <Heading size="h4">{poolStatsValues.volumeWindow}</Heading>
          ) : (
            <Skeleton height="28px" w="100px" />
          )}
        </VStack>
      </FadeInOnView>
      <FadeInOnView scaleUp={false}>
        <VStack align="flex-start" spacing="xxs" w="full">
          <LabelWithTooltip
            label={isOnchainOnly ? `APR for LPs (${windowSuffix})` : 'APR for LPs'}
            tooltip={
              isOnchainOnly
                ? windowAprTooltip(windowKey)
                : 'The APR for Liquidity Providers (LPs) based on the last 24h performance of the pool.'
            }
          />
          {isOnchainOnly ? (
            isLoadingYield && !selected ? (
              <Skeleton height="28px" w="100px" />
            ) : (
              <Heading size="h4">{aprDisplay ?? '—'}</Heading>
            )
          ) : (
            <MemoizedMainAprTooltip
              aprItems={pool.dynamicData.aprItems}
              chain={pool.chain}
              height="28px"
              pool={pool}
              poolId={pool.id}
              textProps={{
                fontSize: ['xl', 'xl', '2xl'],
                fontWeight: 'bold',
                lineHeight: '28px',
              }}
            />
          )}
        </VStack>
      </FadeInOnView>
      {isOnchainOnly && (
        <FadeInOnView scaleUp={false}>
          <VStack align="flex-start" spacing="xxs" w="full">
            <LabelWithTooltip
              label={`APY (${windowSuffix}, compounded)`}
              tooltip="The APR compounded daily: (1 + APR/365)^365 - 1. Swap fees stay in the pool, so the yield compounds automatically. Protocol cut today is 0%, so NET yield equals APR; when a cut is enabled this breaks down to NET = APR x (1 - cut)."
            />
            {apyDisplay !== null ? (
              <Heading size="h4">{apyDisplay}</Heading>
            ) : (
              <Heading size="h4">—</Heading>
            )}
          </VStack>
        </FadeInOnView>
      )}
      <FadeInOnView scaleUp={false}>
        <VStack align="flex-start" spacing="xxs" w="full">
          <LabelWithTooltip
            label={isOnchainOnly ? `${incomeLabel} (${windowSuffix})` : `${incomeLabel} (24h)`}
            tooltip={`The swap fees from trades routed through this pool over the selected ${
              isLifetime ? 'live history' : `trailing ${windowSuffix}`
            }, from the onchain event ledger.`}
          />

          {poolStatsValues ? (
            <Heading size="h4">{poolStatsValues.incomeWindow}</Heading>
          ) : (
            <Skeleton height="28px" w="100px" />
          )}
        </VStack>
      </FadeInOnView>
      <FadeInOnView scaleUp={false}>
        <VStack align="flex-start" spacing="xxs" w="full">
          <LabelWithTooltip
            label="Weekly incentives"
            tooltip={`The weekly liquidity mining incentives for this pool. It includes incentives from the ROOTSTOCK protocol and from unaffiliated third parties. Users must stake to get these.`}
          />
          {poolStatsValues ? (
            <HStack>
              <Heading size="h4">
                {isLoadingTokens ? (
                  <Skeleton height="8" width="28" />
                ) : (
                  poolStatsValues.weeklyRewards
                )}
              </Heading>
              <TokenStackPopover
                chain={chain}
                headerText="Weekly incentives for stakers"
                rewardsByToken={weeklyRewardsByToken}
                tokens={tokens}
              >
                <TokenIconStack
                  chain={chain}
                  disablePopover
                  isLoading={isLoadingTokens}
                  size={20}
                  tokens={tokens}
                />
              </TokenStackPopover>
            </HStack>
          ) : (
            <Skeleton height="28px" w="100px" />
          )}
        </VStack>
      </FadeInOnView>
    </>
  )
}
