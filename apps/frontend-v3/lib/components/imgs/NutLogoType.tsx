import { SVGProps } from 'react'
import { NutLogo } from './NutLogo'

// ROOTSTOCK wordmark — peanut mark + wordmark, drop-in for BalancerLogoType.
export function NutLogoType(props: SVGProps<SVGSVGElement>) {
  const { width, height, ...rest } = props
  return (
    <svg
      className="logo-svg"
      height={height}
      viewBox="0 0 128 21"
      width={width ?? '128px'}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <g transform="translate(0,0.5)">
        <NutLogo width="19" />
      </g>
      <text
        fill="currentColor"
        fontSize="14.5"
        fontWeight="700"
        letterSpacing="0.2"
        style={{ fontFamily: 'inherit' }}
        x="26"
        y="15.5"
      >
        ROOTSTOCK
      </text>
    </svg>
  )
}
