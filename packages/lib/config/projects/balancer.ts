import { ProjectConfig } from '@repo/lib/config/config.types'
import { PartnerVariant, PoolDisplayType, PoolFilterType } from '@repo/lib/modules/pool/pool.types'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isProd, isDev, isStaging } from '@repo/lib/config/app.config'

const prodHiddenPoolTypes = [GqlPoolTypeValues.LiquidityBootstrapping] satisfies PoolFilterType[]

const hiddenPoolTypes: PoolFilterType[] = [
  GqlPoolTypeValues.Fx,
  ...(isProd ? prodHiddenPoolTypes : []),
]

export const ProjectConfigBalancer: ProjectConfig = {
  projectId: 'balancer',
  projectName: 'ROOTSTOCK',
  projectUrl: 'https://rootstock.basednut.com',
  projectLogo: '/images/icons/nut.svg',
  acceptedPoliciesVersion: undefined,
  supportedNetworks: [
    GqlChainValues.Base,

    // testnets only in dev mode — Base Sepolia is our Rootstock deployment
    ...(isProd ? [] : [GqlChainValues.BaseSepolia]),
  ],
  // Base Sepolia: selectable for wallet/onchain actions, never queried from the remote API
  onchainOnlyNetworks: [GqlChainValues.BaseSepolia],
  variantConfig: {
    [PartnerVariant.cow]: {
      banners: {
        headerSrc: '/images/partners/cow-header.svg',
        footerSrc: '/images/partners/cow-footer.svg',
      },
    },
  },
  corePoolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
  defaultNetwork: GqlChainValues.Base,
  // S101 D6 (Boss 2026-09-25): this deployment is Base Sepolia only —
  // pools list preselects BASESEP so no upstream all-chains query runs.
  defaultPoolListNetworks: [GqlChainValues.BaseSepolia],
  ensNetwork: GqlChainValues.Base,
  delegateOwner: '0xba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1b',
  merklRewardsChains: [GqlChainValues.Base],
  options: {
    poolDisplayType: PoolDisplayType.TokenPills,
    hidePoolTags: ['DYNAMIC_ECLP'],
    hidePoolTypes: hiddenPoolTypes,
    hideProtocolVersion: [],
    showPoolName: false,
    showMaBeets: false,
    allowCreateWallet: true,
    isOnSafeAppList: true,
  },
  links: {
    // S100b Boss nav laws (2026-09-24): top menu = in-app actions incl. pool
    // creation (/create). Config is the sole nav source (useNav defaults
    // emptied — duplicate Swap root cause).
    appLinks: [
      { href: '/swap', label: 'Swap' },
      { href: '/create', label: 'Create pool' },
      { href: '/pools', label: 'Pools' },
      { href: '/portfolio', label: 'Portfolio' },
      { href: '/nutusd', label: 'nutUSD' },
      ...(isDev || isStaging ? [{ href: '/lbp/create', label: 'LBP' }] : []),
    ],
    // Ecosystem = everything OUTSIDE the IPFS site (Boss law 2026-09-24).
    // External links only — no internal routes, no '#' placeholders.
    ecosystemLinks: [
      {
        label: 'Audits',
        href: 'https://github.com/BASEDNUT/rootstock-monorepo/audits',
        isExternal: true,
      },
      {
        label: 'Code & contracts',
        href: 'https://github.com/BASEDNUT/rootstock-monorepo',
        isExternal: true,
      },
      { label: 'The Orchard', href: 'https://orchard.basednut.com', isExternal: true },
      { label: 'Forum', href: 'https://basednut.discourse.group', isExternal: true },
    ],
    socialLinks: [
      {
        iconType: 'x',
        href: 'https://x.com/BASEDNUT_',
      },
      {
        iconType: 'github',
        href: 'https://github.com/BASEDNUT/rootstock-monorepo',
      },
    ],
    legalLinks: [
      { label: 'Terms of use', href: '/terms-of-use' },
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Cookies policy', href: '/cookies-policy' },
      { label: '3rd party services', href: '/3rd-party-services' },
      { label: 'Risks', href: '/risks' },
    ],
  },
  footer: {
    linkSections: [
      {
        title: 'Build on ROOTSTOCK',
        links: [
          { label: 'Home', href: '/' },
          {
            label: 'Audits',
            href: 'https://github.com/BASEDNUT/rootstock-monorepo/audits',
            isExternal: true,
          },
          {
            label: 'Code & contracts',
            href: 'https://github.com/BASEDNUT/rootstock-monorepo',
            isExternal: true,
          },
          { label: 'The Orchard', href: 'https://orchard.basednut.com', isExternal: true },
          { label: 'Terminal (data)', href: '#' },
        ],
      },
      {
        title: 'Use ROOTSTOCK',
        links: [
          { label: 'Swap tokens', href: '/swap' },
          { label: 'Create a pool', href: '/create' },
          { label: 'nutUSD vault', href: '/nutusd' },
          {
            label: 'Pools',
            href: '/pools',
          },
          {
            label: 'Portfolio',
            href: '/portfolio',
          },
        ],
      },
      {
        title: 'Ecosystem',
        links: [
          { label: 'Forum', href: 'https://basednut.discourse.group', isExternal: true },
          {
            label: 'Atlas',
            href: 'https://orchard.basednut.com/atlas',
            isExternal: true,
          },
          {
            label: 'Sunflower Grove',
            href: 'https://orchard.basednut.com/sunflower-grove',
            isExternal: true,
          },
          {
            label: 'wNUT Observatory',
            href: 'https://orchard.basednut.com/token/wnut',
            isExternal: true,
          },
          { label: 'Analytics', href: '#' },
          {
            label: 'Brand assets',
            href: 'https://github.com/BASEDNUT',
            isExternal: true,
          },
        ],
      },
    ],
  },
  cowSupportedNetworks: [GqlChainValues.Base, ...(isProd ? [] : [GqlChainValues.Sepolia])],
}
