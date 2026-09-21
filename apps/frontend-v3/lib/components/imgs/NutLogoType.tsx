import { SVGProps } from 'react'
import { NutLogo } from './NutLogo'

// ROOTSTOCK wordmark — peanut mark + wordmark, drop-in for BalancerLogoType.
export function NutLogoType(props: SVGProps<SVGSVGElement>) {
  const { width, height, ...rest } = props
  return (
    <svg
      aria-labelledby="logoTitle logoDesc"
      className="logo-svg"
      viewBox="0 0 128 21"
      xmlns="http://www.w3.org/2000/svg"
      width={width ?? '128px'}
      height={height}
      {...rest}
    >
      <title id="logoTitle">ROOTSTOCK</title>
      <desc id="logoDesc">ROOTSTOCK — liquidity that grows</desc>
      <g transform="translate(0,0.5)">
        <NutLogo width="19" />
      </g>
      <text
        x="26"
        y="15.5"
        fill="currentColor"
      fontSize="14.5"
      fontWeight="700"
      letterSpacing="0.2"
      style={{ fontFamily: 'inherit' }}
      >
        ROOTSTOCK
      </text>
    </svg>
  )
}
