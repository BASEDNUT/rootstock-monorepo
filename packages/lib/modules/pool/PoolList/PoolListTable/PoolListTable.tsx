'use client'

import { PaginatedTable } from '@repo/lib/shared/components/tables/PaginatedTable'
import { PoolListTableHeader } from './PoolListTableHeader'
import { PoolListTableRow } from './PoolListTableRow'
import { getPaginationProps } from '@repo/lib/shared/components/pagination/getPaginationProps'
import { PoolListItem } from '../../pool.types'
import { Card, Skeleton } from '@chakra-ui/react'
import { useIsMounted } from '@repo/lib/shared/hooks/useIsMounted'
import { usePoolList } from '../PoolListProvider'
import { useCallback, useMemo } from 'react'

interface Props {
  pools: PoolListItem[]
  count: number
  loading: boolean
}

export function PoolListTable({ pools, count, loading }: Props) {
  const isMounted = useIsMounted()

  const {
    queryState: { pagination, setPagination, userAddress },
  } = usePoolList()

  const paginationProps = getPaginationProps(count || 0, pagination, setPagination)
  const showPagination = !!pools.length && !!count && count > pagination.pageSize

  const numberColumnWidth = userAddress ? '120px' : '175px'
  const furthestLeftColWidth = '120px'

  // S131 (2026-10-31, Boss-caught): the old fixed grid (~1027px min) pushed
  // the APR column off-screen on phones — the table scrolled horizontally
  // and mobile visitors saw NO APR column at all. Mobile-first responsive
  // grid: compact columns at base so TVL/Volume/APR all fit; the desktop
  // layout is unchanged from md up.
  const desktopGrid = `32px minmax(320px, 1fr) 180px ${
    userAddress ? furthestLeftColWidth : ''
  } ${userAddress ? numberColumnWidth : furthestLeftColWidth} ${numberColumnWidth} 200px`

  const mobileGrid = `32px minmax(120px, 1fr) 90px 90px 80px 70px`

  const rowProps = useMemo(
    () => ({
      px: { base: 'sm', sm: '0' },
      gridTemplateColumns: { base: mobileGrid, md: desktopGrid },
      alignItems: 'center',
      gap: { base: 'xxs', xl: 'lg' },
    }),
    [userAddress, furthestLeftColWidth, numberColumnWidth, mobileGrid, desktopGrid]
  )

  const needsMarginForPoints = pools.some(pool => pool.tags?.some(tag => tag && tag === 'POINTS'))

  const renderTableRow = useCallback(
    ({ item, index }: { item: PoolListItem; index: number }) => (
      <PoolListTableRow
        keyValue={index}
        needsMarginForPoints={needsMarginForPoints}
        pool={item}
        {...rowProps}
      />
    ),
    [needsMarginForPoints, rowProps]
  )

  const renderTableHeader = useCallback(() => <PoolListTableHeader {...rowProps} />, [rowProps])

  if (!isMounted) return <Skeleton height="500px" w="full" />

  return (
    <Card
      alignItems="flex-start"
      left={{ base: '-4px', sm: '0' }}
      overflowX={{ base: 'auto', '2xl': 'hidden' }}
      overflowY="hidden"
      p={{ base: '0', sm: '0' }}
      w="full"
    >
      <PaginatedTable
        getRowId={item => item.id}
        items={pools}
        loading={loading}
        loadingSpinnerPosition="top"
        noItemsFoundLabel="No pools found"
        paginationProps={paginationProps}
        renderTableHeader={renderTableHeader}
        renderTableRow={renderTableRow}
        showPagination={showPagination}
      />
    </Card>
  )
}
