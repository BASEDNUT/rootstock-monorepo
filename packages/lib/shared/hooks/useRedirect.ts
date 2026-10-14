import { useRouter } from 'next/navigation'
import { MouseEvent } from 'react'
import { navTo } from '@repo/lib/shared/utils/ipfs-nav'

export function useRedirect(path: string) {
  const router = useRouter()

  /**
   * Redirects user to page and respects ctrl/cmd clicks to open in new tab.
   */
  function redirectToPage(event?: MouseEvent<HTMLElement>) {
    if (event && (event.ctrlKey || event.metaKey)) {
      window.open(path, '_blank')
    } else {
      navTo(router, path)
    }
  }

  return { redirectToPage }
}
