'use client'

import {
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { GqlPoolOrderBy } from '@repo/lib/shared/services/api/generated/graphql'
import { orderByHash, PoolsColumnSort, YieldWindow } from '../../pool.types'
import { usePoolOrderByState } from '../usePoolOrderByState'
import { ChevronDown, Globe } from 'lucide-react'
import { SortableHeader, Sorting } from '@repo/lib/shared/components/tables/SortableHeader'
import { usePoolList } from '../PoolListProvider'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { PoolListPoolNamesTokens } from './PoolListPoolNamesTokens'

const setIsDesc = (id: GqlPoolOrderBy, currentSortingObj: PoolsColumnSort) =>
  currentSortingObj.id === id ? !currentSortingObj.desc : true

// S134b (2026-11-01): each windowed column owns an INDEPENDENT window,
// chosen from a caret dropdown on its own header (boss-approved design).
// The shared pill selector under APR is dead — a control under APR must
// never silently own another column's window.
const WINDOW_OPTIONS: { value: YieldWindow; label: string }[] = [
  { value: YieldWindow.W24h, label: '24h' },
  { value: YieldWindow.W7d, label: '7d' },
  { value: YieldWindow.W30d, label: '30d' },
  { value: YieldWindow.Lifetime, label: 'Life' },
]

const WINDOW_LABELS: Record<YieldWindow, string> = {
  [YieldWindow.W24h]: '24h',
  [YieldWindow.W7d]: '7d',
  [YieldWindow.W30d]: '30d',
  [YieldWindow.Lifetime]: 'Life',
}

/** Caret dropdown that changes ONE column's window — never sorts. */
function WindowMenu({
  ariaLabel,
  current,
  onChange,
}: {
  ariaLabel: string
  current: YieldWindow
  onChange: (win: YieldWindow) => void
}) {
  return (
    <Menu placement="bottom-end">
      <MenuButton
        aria-label={ariaLabel}
        as={IconButton}
        h="16px"
        icon={<Icon as={ChevronDown} boxSize="3" />}
        minW="14px"
        p="0"
        size="xs"
        variant="ghost"
      />
      <MenuList zIndex="dropdown">
        {WINDOW_OPTIONS.map(option => (
          <MenuItem
            fontWeight={option.value === current ? 'bold' : 'normal'}
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  )
}

export function PoolListTableHeader({ ...rest }) {
  const {
    queryState: { sorting, setSorting, joinablePools },
    aprWindow,
    setAprWindow,
    volumeWindow,
    setVolumeWindow,
  } = usePoolList()

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
        const isVolumeColumn = orderByItem === 'volume24h'

        // S134b: each windowed column names the window it renders —
        // the label always tells its own truth (boss-approved design).
        const columnLabel = isVolumeColumn
          ? `Volume (${WINDOW_LABELS[volumeWindow]})`
          : isAprColumn
            ? `APR (${WINDOW_LABELS[aprWindow]})`
            : orderByHash[orderByItem]!

        return (
          <GridItem
            justifySelf="end"
            key={orderByItem}
            position="relative"
            pr={index === orderBy.length - 1 ? { base: 'md', sm: 'lg', lg: 'sm', xl: '0' } : '0'}
            right="-6px"
          >
            <HStack justify="flex-end" spacing="2px">
              <SortableHeader
                isDisabled={joinablePools}
                isSorted={sortingObj.id === orderByItem}
                label={columnLabel}
                onSort={() => handleSort(orderByItem)}
                sorting={sortingObj.desc ? Sorting.desc : Sorting.asc}
              />
              {(isAprColumn || isVolumeColumn) && (
                <WindowMenu
                  ariaLabel={isAprColumn ? 'APR window' : 'Volume window'}
                  current={isAprColumn ? aprWindow : volumeWindow}
                  onChange={isAprColumn ? setAprWindow : setVolumeWindow}
                />
              )}
            </HStack>
          </GridItem>
        )
      })}
    </Grid>
  )
}
