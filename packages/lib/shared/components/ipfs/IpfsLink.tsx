import type { ReactNode } from 'react'

/**
 * S109 (Boss live E2E walk 2026-09-30): `next/link` is aliased to this file
 * in IPFS export builds (next.config.ts turbopack.resolveAlias — Next 16
 * Turbopack). The static export has no server for client-transition RSC
 * payloads — every link is a full-page anchor so clicks always load on any
 * gateway. Dev builds keep the native next/link client router.
 */
type IpfsLinkProps = {
  href?: string
  children?: ReactNode
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  passHref?: boolean
  legacyBehavior?: boolean
  locale?: string | false
  [key: string]: unknown
}

export default function IpfsLink(props: IpfsLinkProps) {
  const {
    href = '',
    children,
    // next/link-only props — stripped so they never hit the DOM
    prefetch,
    replace,
    scroll,
    shallow,
    passHref,
    legacyBehavior,
    locale,
    ...rest
  } = props

  void prefetch
  void replace
  void scroll
  void shallow
  void passHref
  void legacyBehavior
  void locale

  return (
    <a data-ipfs-link href={href} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  )
}
