import { WORKFLOW_SHELL_LIMITS, panelLimit, type WorkflowShellPanelSide } from "./workflow-shell-state"

const HALF = 2

type WorkflowResizeSashProps = {
  side: WorkflowShellPanelSide
  size: number
  max: number
  onResize: (width: number) => void
}

/** Craft-style sash that keeps the drag hit area centered between workflow panels. */
export function WorkflowResizeSash(props: WorkflowResizeSashProps) {
  const edge = () => (props.side === "right" ? "start" : "end")

  const handleMouseDown = (event: MouseEvent) => {
    event.preventDefault()
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
    >
      <div
        data-component="workflow-resize-sash-hit-area"
        class="absolute inset-y-0 flex cursor-col-resize justify-center"
        style={{
          left: `${-(WORKFLOW_SHELL_LIMITS.sashHitWidth / HALF)}px`,
          right: `${-(WORKFLOW_SHELL_LIMITS.sashHitWidth / HALF)}px`,
        }}
      />
    </div>
  )
}
