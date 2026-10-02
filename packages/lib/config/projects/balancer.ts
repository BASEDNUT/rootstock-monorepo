import { ProjectConfig } from '@repo/lib/config/config.types'
import { PartnerVariant, PoolDisplayType, PoolFilterType } from '@repo/lib/modules/pool/pool.types'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isProd } from '@repo/lib/config/app.config'

const prodHiddenPoolTypes = [GqlPoolTypeValues.LiquidityBootstrapping] satisfies PoolFilterType[]

const hiddenPoolTypes: PoolFilterType[] = [
  GqlPoolTypeValues.Fx,
  ...(isProd ? prodHiddenPoolTypes : []),
]

export const ProjectConfigBalancer: ProjectConfig = {
  projectId: 'balancer',
  projectName: 'ROOTSTOCK',
  projectUrl: 'https://github.com/BASEDNUT/rootstock-monorepo',
  projectLogo: '/images/icons/nut.svg',
  acceptedPoliciesVersion: undefined,
  // S110 (Boss 2026-09-30): two chains for everything — Base Sepolia is
  // our live Rootstock deployment, unconditionally selectable.
  supportedNetworks: [GqlChainValues.Base, GqlChainValues.BaseSepolia],
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
  // S109 (Boss live E2E walk 2026-09-30): the pools-page explainer band —
  // upstream's 4 expandables left an EMPTY band on our ship (promoItems
  // was undefined). Four ROOTSTOCK-native cards, internal links only.
  promoItems: [
    {
      id: 1,
      icon: 'v3',
      label: 'Pools',
      title: 'Weighted pools',
      description: 'Custom weights for any token pair — the flexible default for custom markets.',
      linkText: 'Create a weighted pool',
      linkURL: '/create',
    },
    {
      id: 2,
      icon: 'boosted',
      label: 'Pools',
      title: 'Stable pools',
      description: 'Like-kind assets at a steady 1:1 with lower slippage and fees.',
      linkText: 'Create a stable pool',
      linkURL: '/create',
    },
    {
      id: 3,
      icon: 'autorange',
      label: 'Pools',
      title: 'reCLAMM pools',
      description:
        'Concentrated liquidity that auto-recenters as price moves — capital-efficient by default.',
      linkText: 'Create a reCLAMM pool',
      linkURL: '/create',
    },
    {
      id: 4,
      icon: 'hook',
      label: 'Launch',
      title: 'Liquidity Bootstrapping',
      description: 'Start high, sell down — the fair-launch auction pool for new tokens.',
      linkText: 'Open the launchpad',
      linkURL: '/lbp/create',
    },
  ],
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
    // S106 Boss nav laws v2 final (GO 2026-09-28) — progressive disclosure:
    // possess → observe → trade → create → launch-last (endgame narrative).
    // Launchpad label (Boss pick from my recommendation). Config = sole source.
    appLinks: [
      { href: '/portfolio', label: 'Portfolio' },
      { href: '/pools', label: 'Pools' },
      { href: '/swap', label: 'Swap' },
      { href: '/create', label: 'Create pool' },
      // S106 (PRD-07): the two sibling primitive factories, adjacent.
      { href: '/mint', label: 'Mint token' },
      { href: '/wrap', label: 'Wrap token' },
      // The journey ends at the moment a token goes public.
      { href: '/lbp/create', label: 'Launchpad' },
    ],
    // Ecosystem = everything OUTSIDE the IPFS site (Boss law 2026-09-24).
    // External links only. nutUSD demoted here (S106): Base-mainnet Morpho
    // credit vault — outside the AMM stack. /nutusd page stays alive for
    // deep links only.
    ecosystemLinks: [
      {
        label: 'Docs',
        href: 'https://docs.basednut.com/rootstock',
        isExternal: true,
      },
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
      {
        // S106 Boss order (2026-09-28): the ecosystem menu entry goes to OUR
        // /nutusd page (the doorway) — the page itself carries the real user
        // vault link (app.morpho.org). Never the outside source directly.
        label: 'nutUSD vault',
        href: '/nutusd',
      },
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
            label: 'Docs',
            href: 'https://docs.basednut.com/rootstock',
            isExternal: true,
          },
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
