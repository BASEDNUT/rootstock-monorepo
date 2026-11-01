'use client'

import { Grid, GridItem, Icon, Text, VStack } from '@chakra-ui/react'
import type { GqlPoolOrderBy } from '@repo/lib/shared/services/api/generated/graphql'
import { orderByHash, PoolsColumnSort } from '../../pool.types'
import { usePoolOrderByState } from '../usePoolOrderByState'
import { Globe } from 'lucide-react'
import { SortableHeader, Sorting } from '@repo/lib/shared/components/tables/SortableHeader'
import { usePoolList } from '../PoolListProvider'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { YieldWindow } from '../../pool.types'
import ButtonGroupComponent, {
  type ButtonGroupOption,
} from '@repo/lib/shared/components/btns/button-group/ButtonGroup'
import { HStack } from '@chakra-ui/react'
import { PoolListPoolNamesTokens } from './PoolListPoolNamesTokens'

const setIsDesc = (id: GqlPoolOrderBy, currentSortingObj: PoolsColumnSort) =>
  currentSortingObj.id === id ? !currentSortingObj.desc : true

const WINDOW_OPTIONS: ButtonGroupOption[] = [
  { value: YieldWindow.W24h, label: '24h' },
  { value: YieldWindow.W7d, label: '7d' },
  { value: YieldWindow.W30d, label: '30d' },
  { value: YieldWindow.Lifetime, label: 'Life' },
]

// S134 (2026-11-01): the shared selector drives the Volume column too —
// the header names the window it renders (chips below APR refine BOTH).
const WINDOW_LABELS: Record<YieldWindow, string> = {
  [YieldWindow.W24h]: '24h',
  [YieldWindow.W7d]: '7d',
  [YieldWindow.W30d]: '30d',
  [YieldWindow.Lifetime]: 'Life',
}

export function PoolListTableHeader({ ...rest }) {
  const {
    queryState: { sorting, setSorting, joinablePools },
    yieldWindow,
    setYieldWindow,
  } = usePoolList()

  const windowOption = WINDOW_OPTIONS.find(opt => opt.value === yieldWindow) || WINDOW_OPTIONS[1]

  const handleWindowChange = (selected: ButtonGroupOption) => {
    setYieldWindow(selected.value as YieldWindow)
  }

  const { orderBy } = usePoolOrderByState()
  const sortingObj = sorting[0]!

  const handleSort = (newSortingBy: GqlPoolOrderBy) => {
    setSorting([
      {
        id: newSortingBy,
        desc: setIsDesc(newSortingBy, sortingObj),
      },
    ])
  }

  return (
    <Grid {...rest} p={['sm', 'md']} w="full">
      <GridItem>
        <VStack align="start" w="full">
          <Icon as={Globe} boxSize="5" color="font.primary" />
        </VStack>
      </GridItem>
      <GridItem>
        {PROJECT_CONFIG.options.showPoolName ? (
          <PoolListPoolNamesTokens />
        ) : (
          <Text fontWeight="bold">Name</Text>
        )}
      </GridItem>
      <GridItem display={{ base: 'none', md: 'block' }} justifySelf="start">
        <Text fontWeight="bold" textAlign="left">
          Details
        </Text>
      </GridItem>
      {orderBy.map((orderByItem, index) => {
        const isAprColumn = orderByHash[orderByItem] === 'APR'

        // S134: the Volume header names the window it renders — the shared
        // selector drives it (this deployment is onchain-only by law:
        // every pool row follows the same window).
        const columnLabel =
          orderByItem === 'volume24h'
            ? `Volume (${WINDOW_LABELS[yieldWindow]})`
            : orderByHash[orderByItem]!

        return (
          <GridItem
            justifySelf="end"
            key={orderByItem}
            position="relative"
            pr={index === orderBy.length - 1 ? { base: 'md', sm: 'lg', lg: 'sm', xl: '0' } : '0'}
            right="-6px"
          >
            <SortableHeader
              isDisabled={joinablePools}
              isSorted={sortingObj.id === orderByItem}
              label={columnLabel}
              onSort={() => handleSort(orderByItem)}
              sorting={sortingObj.desc ? Sorting.desc : Sorting.asc}
            />
            {/* S133 (boss-caught 2026-10-31): the window chips belong
                BELOW the APR sort header, not above it — the header is the
                column identity, the chips refine it. */}
            {isAprColumn && (
              <HStack justify="flex-end" mt="2px">
                <ButtonGroupComponent
                  currentOption={windowOption!}
                  groupId="pool-yield-window-list"
                  isGray
                  onChange={handleWindowChange}
                  options={WINDOW_OPTIONS}
                  size="xxs"
                />
              </HStack>
            )}
          </GridItem>
        )
      })}
    </Grid>
  )
}
