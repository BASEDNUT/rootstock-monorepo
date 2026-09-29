import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { IconType } from './SocialIcon'

export type AppLink = {
  href?: string
  label?: string
  icon?: ReactNode
  isExternal?: boolean
  iconType?: IconType
  onClick?: () => void
}

export function useNav() {
  const pathname = usePathname()

  const defaultAppLinks: AppLink[] = [
    // S100b Boss nav law (2026-09-24): duplicate Swap shipped because this
    // default [Swap] was merged with PROJECT_CONFIG appLinks [Swap] in
    // NavBarContainer. Config is now the SOLE nav source — this stays empty.
  ]

  function linkColorFor(path: string) {
    return pathname === path ? 'font.highlight' : 'font.primary'
  }

  return { defaultAppLinks, linkColorFor }
}
