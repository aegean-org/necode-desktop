import { type ComponentProps } from "solid-js"

const NECODE_BACKGROUND = "#080E1C"
const NECODE_PRIMARY = "#FF6B4A"
const NECODE_ACCENT = "#FFB86B"

function NeCodeMark() {
  return (
    <>
      <rect data-slot="necode-mark-background" x="96" y="96" width="832" height="832" rx="184" fill={NECODE_BACKGROUND} />
      <g fill="none" stroke-linecap="round" stroke-width="88">
        <path data-slot="necode-mark-left" d="M332 716 V326" stroke={NECODE_PRIMARY} />
        <path data-slot="necode-mark-right" d="M692 716 V326" stroke={NECODE_PRIMARY} />
        <path data-slot="necode-mark-diagonal" d="M350 332 L674 710" stroke={NECODE_ACCENT} />
      </g>
    </>
  )
}

/** Renders the compact NeCode app mark for small UI placements. */
export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <NeCodeMark />
    </svg>
  )
}

/** Renders the NeCode mark used by startup and connection loading states. */
export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <NeCodeMark />
    </svg>
  )
}

/** Renders the NeCode app mark with a simple wordmark for legacy brand surfaces. */
export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2200 1024"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <NeCodeMark />
      <text
        x="1088"
        y="624"
        fill="currentColor"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="360"
        font-weight="700"
      >
        NeCode
      </text>
    </svg>
  )
}
