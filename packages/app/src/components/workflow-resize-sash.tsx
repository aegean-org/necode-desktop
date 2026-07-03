import { createSignal } from "solid-js"
import { WORKFLOW_SHELL_LIMITS, panelLimit, type WorkflowShellPanelSide } from "./workflow-shell-state"

const HALF = 2
const IDLE_LINE_COLOR = "color-mix(in srgb, var(--v2-text-text-base) 18%, transparent)"
const ACTIVE_LINE_COLOR = "color-mix(in srgb, var(--v2-text-text-base) 36%, transparent)"

type WorkflowResizeSashProps = {
  side: WorkflowShellPanelSide
  size: number
  max: number
  onResize: (width: number) => void
}

/** Craft-style sash that keeps the drag hit area centered between workflow panels. */
export function WorkflowResizeSash(props: WorkflowResizeSashProps) {
  const [active, setActive] = createSignal(false)
  const [hovered, setHovered] = createSignal(false)
  const edge = () => (props.side === "right" ? "start" : "end")

  const handleMouseDown = (event: MouseEvent) => {
    event.preventDefault()
    setActive(true)
    const start = event.clientX
    const startSize = props.size
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor

    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = edge() === "start" ? start - moveEvent.clientX : moveEvent.clientX - start
      props.onResize(Math.min(props.max, Math.max(panelLimit(props.side, "min"), startSize + delta)))
    }

    const handleMouseUp = () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      setActive(false)
      setHovered(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div
      data-component="workflow-resize-sash"
      data-side={props.side}
      data-edge={edge()}
      class="relative z-20 flex h-full w-0 shrink-0 cursor-col-resize justify-center"
      style={{ margin: `0 ${-(WORKFLOW_SHELL_LIMITS.gap / HALF)}px` }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => !active() && setHovered(false)}
    >
      <div
        data-component="workflow-resize-sash-hit-area"
        class="absolute inset-y-0 flex cursor-col-resize justify-center"
        style={{
          left: `${-(WORKFLOW_SHELL_LIMITS.sashHitWidth / HALF)}px`,
          right: `${-(WORKFLOW_SHELL_LIMITS.sashHitWidth / HALF)}px`,
        }}
      >
        <div
          data-component="workflow-resize-sash-line"
          class="absolute left-1/2 -translate-x-1/2 rounded-full transition-[background,opacity] duration-150"
          style={{
            top: `${WORKFLOW_SHELL_LIMITS.stackVerticalOverflow}px`,
            bottom: `${WORKFLOW_SHELL_LIMITS.stackVerticalOverflow}px`,
            width: `${WORKFLOW_SHELL_LIMITS.sashLineWidth}px`,
            opacity: active() || hovered() ? 1 : 0.45,
            background: active() || hovered() ? ACTIVE_LINE_COLOR : IDLE_LINE_COLOR,
          }}
        />
      </div>
    </div>
  )
}
