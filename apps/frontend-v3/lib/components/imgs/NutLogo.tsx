import { SVGProps } from 'react'

// BASED NUT mark — clean peanut silhouette.
// Same visual language as the balancer stones: organic, rounded, single fill, currentColor.
export function NutLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 26 21" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M13 1.2c4.8 0 6.5 2.8 6.3 5.8-.1 2-.9 3.2-2.1 3.9 1.3.7 2.2 2 2.2 4.1 0 3-2 5.3-6.4 5.3S6.6 18 6.6 15c0-2.1.9-3.4 2.2-4.1-1.2-.7-2-1.9-2.1-3.9C6.5 4 8.2 1.2 13 1.2Z"
        fill="currentColor"
      />
    </svg>
  )
}
