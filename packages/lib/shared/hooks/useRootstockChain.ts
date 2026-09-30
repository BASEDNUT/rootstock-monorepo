'use client'

import { makeVar } from '@apollo/client'
import { useReactiveVar } from '@apollo/client/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'

/**
 * S110 (Boss 2026-09-30): two chains for everything, one pick.
 *
 * A single persisted reactive var — the chain picked on ANY surface (swap,
 * create pool, launchpad, mint, wrap) stays across every other surface
 * until the user changes it. localStorage-backed, SSR-safe (module-level
 * read guarded by typeof window).
 */
const STORAGE_KEY = 'rootstock.selectedChain'

const OUR_CHAINS: GqlChain[] = [GqlChainValues.Base, GqlChainValues.BaseSepolia]

function readStoredChain(): GqlChain {
  if (typeof window === 'undefined') return PROJECT_CONFIG.defaultNetwork

  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && (OUR_CHAINS as string[]).includes(v)) return v as GqlChain
  } catch {
    // private mode / storage unavailable — fall through to default
  }

  return PROJECT_CONFIG.defaultNetwork
}

export const rootstockChainVar = makeVar<GqlChain>(readStoredChain())

/** One pick, every surface — persists across pages until changed. */
export function setRootstockChain(chain: GqlChain) {
  rootstockChainVar(chain)

  try {
    window.localStorage.setItem(STORAGE_KEY, chain)
  } catch {
    // storage unavailable — the reactive var still holds this session's pick
  }
}

export function useRootstockChain(): GqlChain {
  return useReactiveVar(rootstockChainVar)
}
