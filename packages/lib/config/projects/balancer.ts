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
    GqlChainValues.Mainnet,
    GqlChainValues.Monad,
    GqlChainValues.Arbitrum,
    GqlChainValues.Base,
    GqlChainValues.Gnosis,
    GqlChainValues.Hyperevm,
    GqlChainValues.Avalanche,
    GqlChainValues.Optimism,
    GqlChainValues.Plasma,
    GqlChainValues.Polygon,

    // testnets only in dev mode
    ...(isProd ? [] : [GqlChainValues.Sepolia]),
  ],
  variantConfig: {
    [PartnerVariant.cow]: {
      banners: {
        headerSrc: '/images/partners/cow-header.svg',
        footerSrc: '/images/partners/cow-footer.svg',
      },
    },
  },
  corePoolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
  defaultNetwork: GqlChainValues.Mainnet,
  ensNetwork: GqlChainValues.Mainnet,
  delegateOwner: '0xba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1b',
  merklRewardsChains: [GqlChainValues.Mainnet, GqlChainValues.Arbitrum, GqlChainValues.Base],
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
    appLinks: [
      { href: '/nutusd', label: 'nutUSD' },
      ...(isDev || isStaging ? [{ href: '/lbp/create', label: 'LBP' }] : []),
    ],
    ecosystemLinks: [
      { label: 'Pool creator', href: '/create' },
      { label: 'Audits', href: 'https://github.com/BASEDNUT/rootstock-monorepo/audits', isExternal: true },
      { label: 'Code & contracts', href: 'https://github.com/BASEDNUT/rootstock-monorepo', isExternal: true },
      { label: 'The Orchard', href: 'https://orchard.basednut.com', isExternal: true },
      { label: 'Terminal (data)', href: 'https://terminal.basednut.com', isExternal: true },
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
          { label: 'Audits', href: 'https://github.com/BASEDNUT/rootstock-monorepo/audits', isExternal: true },
          { label: 'Code & contracts', href: 'https://github.com/BASEDNUT/rootstock-monorepo', isExternal: true },
          { label: 'The Orchard', href: 'https://orchard.basednut.com', isExternal: true },
          { label: 'Terminal (data)', href: 'https://terminal.basednut.com', isExternal: true },
        ],
      },
      {
        title: 'Use ROOTSTOCK',
        links: [
          { label: 'Swap tokens', href: '/swap' },
          { label: 'Create a pool', href: '/create' },
          { label: 'nutUSD vault', href: '/nutusd' },
          {
            label: 'Pools & portfolio (data)',
            href: 'https://terminal.basednut.com',
            isExternal: true,
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
          { label: 'Sunflower Grove', href: 'https://orchard.basednut.com/sunflower-grove', isExternal: true },
          { label: 'wNUT Observatory', href: 'https://orchard.basednut.com/token/wnut', isExternal: true },
          { label: 'Analytics', href: 'https://terminal.basednut.com', isExternal: true },
          {
            label: 'Brand assets',
            href: 'https://github.com/BASEDNUT',
            isExternal: true,
          },
        ],
      },
    ],
  },
  cowSupportedNetworks: [
    GqlChainValues.Mainnet,
    GqlChainValues.Arbitrum,
    GqlChainValues.Base,
    GqlChainValues.Gnosis,
    ...(isProd ? [] : [GqlChainValues.Sepolia]),
  ],
  partnerCards: [
    {
      backgroundImage: 'images/partners/cards/partner-xave-bg.png',
      bgColor: 'blue.400',
      ctaText: 'View pools',
      ctaUrl: 'pools?poolTypes=QUANT_AMM_WEIGHTED',
      description:
        'Auto-rebalancing pools designed to capture additional yield from price volatility.',
      externalLink: false,
      iconName: 'quantamm',
      title: 'QuantAMM',
    },
    {
      backgroundImage: 'images/partners/cards/partner-cow-bg.png',
      bgColor: 'green.900',
      ctaText: 'View pools',
      ctaUrl: '/pools/cow',
      description: 'The first MEV-capturing AMM. More returns, less risk with LVR protection.',
      iconName: 'cow',
      title: 'CoW AMM',
    },
    {
      backgroundImage: 'images/partners/cards/partner-gyro-bg.png',
      bgColor: 'pink.600',
      ctaText: 'View pools',
      ctaUrl: 'pools?poolTypes=GYRO',
      description: 'Concentrated Liquidity Pools on Balancer. Improves capital efficiency for LPs.',
      externalLink: false,
      iconName: 'gyro',
      title: 'Gyroscope',
    },
  ],
  promoItems: [
    {
      id: 0,
      icon: 'monad',
      label: 'Monad',
      title: 'Explore pools on Monad',
      description:
        'The High-Performance EVM Blockchain Built for Scale. 10,000 TPS, sub-second finality, low fees, and scalable decentralization.',
      buttonText: 'View pools',
      buttonLink: '/pools?networks=MONAD',
      linkText: 'Learn more',
      linkURL: 'https://www.monad.xyz/',
      linkExternal: true,
      bgImageActive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-active2',
      },
      bgImageInactive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-inactive2',
      },
    },
    {
      id: 1,
      icon: 'autorange',
      label: 'AutoRange Pools',
      title: 'New readjusting Concentrated Liquidity Pools',
      description:
        'Maximize capital efficiency with AutoRange pools: Auto-readjusting concentrated liquidity—no micro-management of positions needed.',
      buttonText: 'View pools',
      buttonLink: '/pools?poolTypes=AUTORANGE',
      linkText: 'Learn more',
      linkURL: 'https://terminal.basednut.com',
      linkExternal: true,
      bgImageActive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-active0',
      },
      bgImageInactive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-inactive0',
      },
    },
    {
      id: 2,
      icon: 'boosted',
      label: 'Boosted Pools',
      title: '100% Boosted Pools',
      description:
        'A simple, capital efficient strategy for LPs to get boosted yield. Partnering with leading lending protocols like Aave and Morpho.',
      buttonText: 'View pools',
      buttonLink: '/pools?poolTags=BOOSTED',
      linkText: 'Learn more',
      linkURL: 'https://terminal.basednut.com',
      linkExternal: true,
      bgImageActive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-active1',
      },
      bgImageInactive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-inactive1',
      },
    },
    {
      id: 3,
      icon: 'hook',
      label: 'StableSurge Hook',
      title: 'StableSurge Hook',
      description:
        'A dynamic directional surge swap fee in times of volatility to help defend the peg. LPs get MEV protection and increased fees.',
      buttonText: 'View pools',
      buttonLink: '/pools?poolHookTags=HOOKS_STABLESURGE',
      linkText: 'Learn more',
      linkURL: 'https://terminal.basednut.com',
      linkExternal: true,
      bgImageActive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-active3',
      },
      bgImageInactive: {
        directory: '/images/promos/promo-banner/',
        imgName: 'bg-inactive3',
      },
    },
    //   bgImageInactive: {
    //     directory: '/images/promos/promo-banner/',
    //     imgName: 'bg-inactive2',
    //   },
    // },
    // {
    //   id: 2,
    //   icon: 'gyro',
    //   label: 'Gyroscope',
    //   title: 'Superliquidity, made simple',
    //   description:
    //     'Next generation Gyroscope pools are now live on Balancer v3. Manage liquidity directly within the Balancer UI.',
    //   buttonText: 'View pools',
    //   buttonLink: '/pools?protocolVersion=3&poolTypes=GYRO',
    //   linkText: 'Learn more',
    //   linkURL: 'https://www.gyro.finance/',
    //   linkExternal: true,
    //   bgImageActive: {
    //     directory: '/images/promos/promo-banner/',
    //     imgName: 'bg-active2',
    //   },
    //   bgImageInactive: {
    //     directory: '/images/promos/promo-banner/',
    //     imgName: 'bg-inactive2',
    //   },
    // },
  ],
}
