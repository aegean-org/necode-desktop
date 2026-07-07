import { createResizeObserver } from "@solid-primitives/resize-observer"
import { Show, createEffect, createMemo, onCleanup, onMount, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { WorkflowResizeSash } from "./workflow-resize-sash"
import {
  WORKFLOW_SHELL_LIMITS,
  clampWorkflowPanelWidth,
  parseWorkflowPanelWidth,
  workflowPanelWidthAfterPropSync,
  workflowPanelChromeStyle,
  workflowPanelResizeMax,
  workflowPanelScrollStyle,
  workflowPanelStackStyle,
  workflowPanelSurfaceClass,
  workflowPanelUsesChrome,
  workflowShellLayoutMode,
  workflowShellOuterStyle,
  type WorkflowShellPanelSide,
} from "./workflow-shell-state"

const PANEL_SLOT = "relative min-h-0 min-w-0 overflow-hidden"
const PANEL_CHROME = `${PANEL_SLOT} overflow-hidden`

type PanelWidth = number | string

type WorkflowShellProps = {
  left?: JSX.Element
  navigator?: JSX.Element
  center: JSX.Element
  right?: JSX.Element
  leftWidth?: PanelWidth
  navigatorWidth?: PanelWidth
  rightWidth?: PanelWidth
  storageKey?: string
}

type PanelVisibility = Record<WorkflowShellPanelSide, () => boolean>
type PanelSizes = Record<WorkflowShellPanelSide, number>
type SetPanelSize = (side: WorkflowShellPanelSide, width: number) => void

/** Craft-style resizable workflow shell shared by home and session pages. */
export function WorkflowShell(props: WorkflowShellProps) {
  const sizing = createWorkflowShellSizing(props)
  const leftVisible = sizing.leftVisible
  const navigatorVisible = sizing.navigatorVisible
  const rightVisible = sizing.rightVisible

  return (
    <div
      ref={sizing.setRoot}
      data-component="workflow-shell"
      data-layout-mode={sizing.layoutMode()}
      class="flex min-h-0 flex-1 items-stretch self-stretch overflow-hidden"
      style={workflowShellOuterStyle()}
    >
      <div
        data-component="workflow-panel-scroll"
        class="relative flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={workflowPanelScrollStyle()}
      >
        <div
          data-component="workflow-panel-stack"
          class="flex h-full min-w-0"
          style={workflowPanelStackStyle({ hasLeft: leftVisible() })}
        >
          <WorkflowSidePanel
            side="left"
            content={leftVisible() ? props.left : undefined}
            width={sizing.leftWidth()}
            atLeftEdge
            atRightEdge={false}
          />

          <Show when={leftVisible() && sizing.layoutMode() === "desktop"}>
            <WorkflowResize side="left" size={sizing.leftWidth()} max={sizing.leftMax()} onResize={sizing.resizePanel} />
          </Show>

          <WorkflowSidePanel
            side="navigator"
            content={navigatorVisible() ? props.navigator : undefined}
            width={sizing.navigatorWidth()}
            atLeftEdge={!leftVisible()}
            atRightEdge={false}
          />

          <Show when={navigatorVisible() && sizing.layoutMode() === "desktop"}>
            <WorkflowResize
              side="navigator"
              size={sizing.navigatorWidth()}
              max={sizing.navigatorMax()}
              onResize={sizing.resizePanel}
            />
          </Show>

          <section
            data-panel-role="content"
            class={`${PANEL_CHROME} ${workflowPanelSurfaceClass("content")} flex flex-1 flex-col`}
            style={{
              ...workflowPanelChromeStyle({ atLeftEdge: !leftVisible() && !navigatorVisible(), atRightEdge: !rightVisible() }),
              "min-width": `${WORKFLOW_SHELL_LIMITS.centerMin}px`,
            }}
          >
            {props.center}
          </section>
        </div>
      </div>

      <Show when={rightVisible() && sizing.layoutMode() === "desktop"}>
        <WorkflowResize side="right" size={sizing.rightWidth()} max={sizing.rightMax()} onResize={sizing.resizePanel} />
      </Show>

      <WorkflowSidePanel
        side="right"
        content={rightVisible() ? props.right : undefined}
        width={sizing.rightWidth()}
        atLeftEdge={false}
        atRightEdge
      />
    </div>
  )
}

function createWorkflowShellSizing(props: WorkflowShellProps) {
  let root: HTMLDivElement | undefined
  const [metrics, setMetrics] = createStore({ width: 0 })
  const [sizes, setSizes] = createWorkflowPanelSizeStore(props)
  const layoutMode = createMemo(() => workflowShellLayoutMode(metrics.width))
  const visible = createWorkflowPanelVisibility(props, layoutMode)
  syncWorkflowPanelWidthProps(props, sizes, (side, width) => setSizes(side, width))
  const fixedPanelCount = createMemo(() => workflowFixedPanelCount(visible))
  const panelContext = (side: WorkflowShellPanelSide) =>
    workflowPanelSizingContext({
      side,
      sizes,
      visible,
      fixedPanelCount: fixedPanelCount(),
      containerWidth: metrics.width,
    })
  const leftWidth = createMemo(() => clampWorkflowPanelWidth(panelContext("left")))
  const navigatorWidth = createMemo(() => clampWorkflowPanelWidth(panelContext("navigator")))
  const rightWidth = createMemo(() => clampWorkflowPanelWidth(panelContext("right")))
  const syncRootWidth = () => setMetrics("width", root?.clientWidth ?? 0)

  createResizeObserver(() => root, syncRootWidth)
  onMount(() => {
    syncRootWidth()
    window.addEventListener("resize", syncRootWidth)
  })
  onCleanup(() => window.removeEventListener("resize", syncRootWidth))

  return {
    setRoot: (el: HTMLDivElement) => {
      root = el
      syncRootWidth()
    },
    layoutMode,
    leftVisible: visible.left,
    navigatorVisible: visible.navigator,
    rightVisible: visible.right,
    leftWidth,
    navigatorWidth,
    rightWidth,
    leftMax: () => workflowPanelResizeMax(panelContext("left")),
    navigatorMax: () => workflowPanelResizeMax(panelContext("navigator")),
    rightMax: () => workflowPanelResizeMax(panelContext("right")),
    resizePanel: (side: WorkflowShellPanelSide, width: number) =>
      setSizes(side, clampWorkflowPanelWidth({ ...panelContext(side), width })),
  }
}

function createWorkflowPanelSizeStore(props: WorkflowShellProps) {
  return persisted(
    Persist.global(props.storageKey ?? "workflow-shell.panels"),
    createStore({
      left: parseWorkflowPanelWidth(props.leftWidth, WORKFLOW_SHELL_LIMITS.leftDefault),
      navigator: parseWorkflowPanelWidth(props.navigatorWidth, WORKFLOW_SHELL_LIMITS.navigatorDefault),
      right: parseWorkflowPanelWidth(props.rightWidth, WORKFLOW_SHELL_LIMITS.rightDefault),
    }),
  )
}

function syncWorkflowPanelWidthProps(props: WorkflowShellProps, sizes: PanelSizes, setPanelSize: SetPanelSize) {
  syncWorkflowPanelWidthProp({
    side: "left",
    sizes,
    setPanelSize,
    propWidth: createMemo(() => parseWorkflowPanelWidth(props.leftWidth, WORKFLOW_SHELL_LIMITS.leftDefault)),
  })
  syncWorkflowPanelWidthProp({
    side: "navigator",
    sizes,
    setPanelSize,
    propWidth: createMemo(() => parseWorkflowPanelWidth(props.navigatorWidth, WORKFLOW_SHELL_LIMITS.navigatorDefault)),
  })
  syncWorkflowPanelWidthProp({
    side: "right",
    sizes,
    setPanelSize,
    propWidth: createMemo(() => parseWorkflowPanelWidth(props.rightWidth, WORKFLOW_SHELL_LIMITS.rightDefault)),
  })
}

function syncWorkflowPanelWidthProp(input: {
  side: WorkflowShellPanelSide
  sizes: PanelSizes
  setPanelSize: SetPanelSize
  propWidth: () => number
}) {
  let previousPropWidth = input.propWidth()

  createEffect(() => {
    const nextPropWidth = input.propWidth()
    const nextWidth = workflowPanelWidthAfterPropSync({
      currentWidth: input.sizes[input.side],
      previousPropWidth,
      nextPropWidth,
    })
    previousPropWidth = nextPropWidth
    if (nextWidth === input.sizes[input.side]) return
    input.setPanelSize(input.side, nextWidth)
  })
}

function createWorkflowPanelVisibility(props: WorkflowShellProps, layoutMode: () => string): PanelVisibility {
  return {
    left: createMemo(() => !!props.left),
    navigator: createMemo(() => !!props.navigator),
    right: createMemo(() => layoutMode() === "desktop" && !!props.right),
  }
}

function workflowFixedPanelCount(visible: PanelVisibility) {
  return [visible.left(), visible.navigator(), visible.right()].filter(Boolean).length
}

function workflowPanelSizingContext(input: {
  side: WorkflowShellPanelSide
  sizes: PanelSizes
  visible: PanelVisibility
  fixedPanelCount: number
  containerWidth: number
}) {
  return {
    side: input.side,
    width: input.sizes[input.side],
    containerWidth: input.containerWidth,
    otherPanelWidth: workflowOtherPanelWidth(input.side, input.sizes, input.visible),
    otherPanelVisible: workflowHasOtherPanel(input.side, input.visible),
    fixedPanelCount: input.fixedPanelCount,
  }
}

function workflowHasOtherPanel(side: WorkflowShellPanelSide, visible: PanelVisibility) {
  if (side === "left") return visible.navigator() || visible.right()
  if (side === "navigator") return visible.left() || visible.right()
  return visible.left() || visible.navigator()
}

function workflowOtherPanelWidth(side: WorkflowShellPanelSide, sizes: PanelSizes, visible: PanelVisibility) {
  if (side === "left") return (visible.navigator() ? sizes.navigator : 0) + (visible.right() ? sizes.right : 0)
  if (side === "navigator") return (visible.left() ? sizes.left : 0) + (visible.right() ? sizes.right : 0)
  return (visible.left() ? sizes.left : 0) + (visible.navigator() ? sizes.navigator : 0)
}

function WorkflowSidePanel(props: {
  side: WorkflowShellPanelSide
  content?: JSX.Element
  width: number
  atLeftEdge: boolean
  atRightEdge: boolean
}) {
  const usesChrome = () => workflowPanelUsesChrome(props.side)
  return (
    <Show when={props.content}>
      {(content) => (
        <section
          data-panel-role={workflowPanelRole(props.side)}
          class={`${usesChrome() ? PANEL_CHROME : PANEL_SLOT} ${workflowPanelSurfaceClass(props.side)} flex shrink-0 flex-col`}
          style={{
            ...(usesChrome()
              ? workflowPanelChromeStyle({ atLeftEdge: props.atLeftEdge, atRightEdge: props.atRightEdge })
              : {}),
            width: `${props.width}px`,
          }}
        >
          {content()}
        </section>
      )}
    </Show>
  )
}

function WorkflowResize(props: {
  side: WorkflowShellPanelSide
  size: number
  max: number
  onResize: (side: WorkflowShellPanelSide, width: number) => void
}) {
  return (
    <WorkflowResizeSash
      side={props.side}
      size={props.size}
      max={props.max}
      onResize={(width) => props.onResize(props.side, width)}
    />
  )
}

function workflowPanelRole(side: WorkflowShellPanelSide) {
  if (side === "left") return "sidebar"
  if (side === "navigator") return "navigator"
  return "right-sidebar"
}
