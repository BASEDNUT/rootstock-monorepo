/**
 * Apollo Global Data Provider
 *
 * This component is used to fetch data that is needed for the entire
 * application during the RSC render pass.
 */
import { getApolloServerClient } from '@repo/lib/shared/services/api/apollo-server.client'
import { GetProtocolStatsDocument } from '@repo/lib/shared/services/api/generated/graphql'
import { TokensProvider } from '@repo/lib/modules/tokens/TokensProvider'
import { FiatFxRatesProvider } from '../../hooks/FxRatesProvider'
import { getFxRates } from '../../utils/currencies'
import { mins } from '../../utils/time'
import { PropsWithChildren } from 'react'
import { getHooksMetadata } from '@repo/lib/modules/hooks/getHooksMetadata'
import { HooksProvider } from '@repo/lib/modules/hooks/HooksProvider'
import { getPoolTags } from '@repo/lib/modules/pool/tags/getPoolTags'
import { PoolTagsProvider } from '@repo/lib/modules/pool/tags/PoolTagsProvider'
import { getErc4626Metadata } from '@repo/lib/modules/pool/metadata/getErc4626Metadata'
import { PoolsMetadataProvider } from '@repo/lib/modules/pool/metadata/PoolsMetadataProvider'
import { getPoolsMetadata } from '@repo/lib/modules/pool/metadata/getPoolsMetadata'
import { PROJECT_CONFIG, toApiNetworks } from '@repo/lib/config/getProjectConfig'
import { ProtocolStatsProvider } from '@repo/lib/modules/protocol/ProtocolStatsProvider'
import { FeeManagersProvider } from '@repo/lib/modules/fee-managers/FeeManagersProvider'
import { getFeeManagersMetadata } from '@repo/lib/modules/fee-managers/getFeeManagersMetadata'
import { getPoolMigrations } from '@repo/lib/modules/pool/migrations/getPoolMigrations'
import { PoolMigrationsProvider } from '@repo/lib/modules/pool/migrations/PoolMigrationsProvider'

export const revalidate = 60

/** Rootstock S100b (F8, 2026-09-23): export-mode API gate. */
const isIpfsExport = process.env.ROOTSTOCK_EXPORT === '1'

export async function ApolloGlobalDataProvider({ children }: PropsWithChildren) {
  const client = getApolloServerClient()

  // Rootstock S100b (F8): NEVER query api-v3.balancer.fi during static
  // export prerender. Every page render fired this query — 135 pages × 48
  // workers burst-triggered Cloudflare 429 rate-limits that killed builds
  // at random pool pages (three builds in a row). All consumers are
  // optional-chained; undefined protocolData degrades gracefully (stats
  // sections hide). Onchain-only law: the export never needs remote stats.
  let protocolData: Awaited<ReturnType<typeof client.query>>['data'] | undefined

  if (!isIpfsExport) {
    ;({ data: protocolData } = await client.query({
      query: GetProtocolStatsDocument,
      variables: {
        chains: toApiNetworks(
          PROJECT_CONFIG.networksForProtocolStats || PROJECT_CONFIG.supportedNetworks
        ),
      },
      context: {
        fetchOptions: {
          next: { revalidate: mins(10).toSecs() },
        },
      },
    }))
  }

  const [
    exchangeRates,
    hooksMetadata,
    poolTags,
    erc4626Metadata,
    poolsMetadata,
    feeManagersMetadata,
    poolMigrations,
  ] = await Promise.all([
    getFxRates(),
    getHooksMetadata(),
    getPoolTags(),
    getErc4626Metadata(),
    getPoolsMetadata(),
    getFeeManagersMetadata(),
    getPoolMigrations(),
  ])

  return (
    <TokensProvider>
      <FiatFxRatesProvider data={exchangeRates}>
        <PoolTagsProvider data={poolTags}>
          <HooksProvider data={hooksMetadata}>
            <FeeManagersProvider data={feeManagersMetadata}>
              <ProtocolStatsProvider data={protocolData}>
                <PoolsMetadataProvider
                  erc4626Metadata={erc4626Metadata}
                  poolsMetadata={poolsMetadata}
                >
                  <PoolMigrationsProvider poolMigrations={poolMigrations}>
                    {children}
                  </PoolMigrationsProvider>
                </PoolsMetadataProvider>
              </ProtocolStatsProvider>
            </FeeManagersProvider>
          </HooksProvider>
        </PoolTagsProvider>
      </FiatFxRatesProvider>
    </TokensProvider>
  )
}
