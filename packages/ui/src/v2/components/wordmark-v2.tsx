import { createUniqueId, type ComponentProps } from "solid-js"

const WORDMARK_VIEWBOX_WIDTH = 720.002
const WORDMARK_MASK_WIDTH = 720
const WORDMARK_CENTER = WORDMARK_MASK_WIDTH / 2

const NECODE_WORDMARK_PATHS = [
  {
    d: "M332.306 36.8583H295.383V110.573H276.922V18.4297H332.306V36.8583Z",
    transform: "translate(-184.617 0)",
  },
  {
    d: "M350.768 110.573H332.306V36.8583H350.768V110.573Z",
    transform: "translate(-184.617 0)",
  },
  {
    d: "M258.463 73.7154H203.079V92.144H258.463V110.573H184.617V18.4297H258.463V73.7154ZM203.079 55.2868H240.002V36.8583H203.079V55.2868Z",
    transform: "translate(0 0)",
  },
  {
    d: "M443.081 36.8583H387.696V92.144H443.081V110.573H369.234V18.4297H443.081V36.8583Z",
    transform: "translate(-92.312 0)",
  },
  {
    d: "M516.924 36.8583H480.001V92.144H516.924V36.8583ZM535.385 110.573H461.539V18.4297H535.385V110.573Z",
    transform: "translate(-92.312 0)",
  },
  {
    d: "M609.228 36.8571H572.305V92.1429H609.228V36.8571ZM627.69 110.571H553.844V18.4286H609.228V0H627.69V110.571Z",
    transform: "translate(-92.312 0)",
  },
  {
    d: "M664.618 36.8583V55.2868H701.541V36.8583H664.618ZM720.002 73.7154H664.618V92.144H720.002V110.573H646.156V18.4297H720.002V73.7154Z",
    transform: "translate(-92.312 0)",
  },
] as const

/** Renders the NECode wordmark used by the desktop new-session hero. */
export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const filter = createUniqueId()
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${WORDMARK_VIEWBOX_WIDTH} 129.001`}
      fill="none"
      preserveAspectRatio="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.16" filter={`url(#${filter})`} mask={`url(#${mask})`}>
        {NECODE_WORDMARK_PATHS.map((path) => (
          <path opacity="0.7" d={path.d} transform={path.transform} fill="currentColor" />
        ))}
      </g>
      <WordmarkDefs filter={filter} mask={mask} maskGradient={maskGradient} />
    </svg>
  )
}

function WordmarkDefs(props: { filter: string; mask: string; maskGradient: string }) {
  return (
    <defs>
      <mask id={props.mask} maskUnits="userSpaceOnUse" x="0" y="0" width={WORDMARK_MASK_WIDTH} height="129">
        <rect width={WORDMARK_MASK_WIDTH} height="129" fill={`url(#${props.maskGradient})`} />
      </mask>
      <linearGradient
        id={props.maskGradient}
        x1={WORDMARK_CENTER}
        y1="0"
        x2={WORDMARK_CENTER}
        y2="112"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="white" stop-opacity="0.7" />
        <stop offset="1" stop-color="white" stop-opacity="0" />
      </linearGradient>
      <filter
        id={props.filter}
        x="0"
        y="0"
        width={WORDMARK_VIEWBOX_WIDTH}
        height="130.001"
        filterUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="1" />
        <feGaussianBlur stdDeviation="1" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_4938_16028" />
      </filter>
    </defs>
  )
}
