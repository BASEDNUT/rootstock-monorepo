import { TransactionStateProvider } from '@repo/lib/modules/transactions/transaction-steps/TransactionStateProvider'
import ClaimNetworkPoolsLayoutWrapper from '@repo/lib/modules/portfolio/PortfolioClaim/ClaimNetworkPools/ClaimNetworkPoolsLayoutWrapper'

// Rootstock S100 (IPFS export): enumerate known chains so this route can be
// statically exported. In-app navigation updates URL via history.replaceState
// (no RSC fetch), so only deep links beyond these params are not pre-rendered.
export function generateStaticParams() {
  return [{ chain: 'base' }, { chain: 'base-sepolia' }]
}



export default function NetworkClaim() {
  return (
    <TransactionStateProvider>
      <ClaimNetworkPoolsLayoutWrapper />
    </TransactionStateProvider>
  )
}
