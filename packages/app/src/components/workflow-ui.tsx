import { type JSX } from "solid-js"

/** Shared label class for workflow section headings. */
export const WORKFLOW_SECTION_LABEL =
  "text-[11px] uppercase leading-4 tracking-wider text-v2-text-text-muted [font-weight:530]"

/** Shared badge class for compact workflow counts and metadata. */
export const WORKFLOW_BADGE =
  "rounded-[999px] bg-[var(--workflow-panel-base)] px-2 py-0.5 text-[11px] leading-4 text-v2-text-text-muted shadow-[var(--workflow-elevation-minimal)] [font-weight:530]"

/** Shared class for compact selectable workflow navigation rows. */
export const WORKFLOW_NAV_ROW =
  "flex h-7 min-w-0 w-full cursor-default items-center gap-2 rounded-[6px] border-0 bg-transparent px-2 text-left text-[13px] leading-4 text-v2-text-text-muted transition-[background-color,color] duration-[120ms] ease-in-out hover:bg-[var(--workflow-row-hover)] hover:text-v2-text-text-base data-[selected]:bg-[var(--workflow-row-selected)] data-[selected]:text-v2-text-text-base data-[selected]:hover:bg-[var(--workflow-row-selected)] focus-visible:bg-[var(--workflow-row-hover)] focus-visible:text-v2-text-text-base focus-visible:outline-none [font-weight:440]"

/** Shared class for selectable workflow entity rows. */
export const WORKFLOW_ENTITY_ROW =
  "min-w-0 cursor-default rounded-[8px] border-0 bg-transparent text-left transition-[background-color,color,box-shadow] duration-[120ms] ease-in-out hover:bg-[var(--workflow-row-hover)] data-[selected]:bg-[var(--workflow-row-selected)] data-[selected]:[box-shadow:var(--workflow-elevation-minimal)] focus-within:bg-[var(--workflow-row-hover)] focus-within:outline-none focus-within:[box-shadow:inset_0_0_0_0.5px_var(--v2-border-border-focus)]"

/** Shared class for muted workflow surfaces. */
export const WORKFLOW_SURFACE_CARD =
  "rounded-[8px] bg-[var(--workflow-surface-muted)] shadow-[var(--workflow-elevation-minimal)]"

/** Shared class for selectable workflow surface buttons. */
export const WORKFLOW_SURFACE_BUTTON =
  `${WORKFLOW_SURFACE_CARD} border-0 transition-[background-color,box-shadow] duration-[120ms] ease-in-out hover:bg-[var(--workflow-surface-muted-hover)] data-[selected]:[box-shadow:inset_0_0_0_0.5px_var(--v2-border-border-focus),var(--workflow-elevation-minimal)] focus-visible:bg-[var(--workflow-surface-muted-hover)] focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_0.5px_var(--v2-border-border-focus),var(--workflow-elevation-minimal)]`

/** Builds stable data attributes for workflow entity rows. */
export function workflowEntityRowDataAttributes(input: { selected?: boolean; rowID?: string }) {
  return {
    "data-selected": input.selected ? "" : undefined,
    "data-row-id": input.rowID,
  }
}

/** Shared workflow entity row primitive for dense workspace, project, session, and task lists. */
export function WorkflowEntityRow(props: {
  title: JSX.Element
  subtitle?: JSX.Element
  icon?: JSX.Element
  badge?: JSX.Element
  trailing?: JSX.Element
  actions?: JSX.Element
  selected?: boolean
  rowID?: string
  class?: string
  onSelect?: () => void
}) {
  return (
    <div
      data-component="workflow-entity-row"
      {...workflowEntityRowDataAttributes({ selected: props.selected, rowID: props.rowID })}
      class={`group relative min-h-[58px] w-full min-w-0 ${WORKFLOW_ENTITY_ROW} ${props.class ?? ""}`}
    >
      <button
        type="button"
        data-component="workflow-entity-row-select"
        class="flex w-full min-w-0 cursor-default items-start gap-2 border-0 bg-transparent px-3 py-3 pr-10 text-left focus-visible:outline-none"
        onClick={props.onSelect}
      >
        {props.icon ? <div class="mt-0.5 flex size-4 shrink-0 items-center justify-center">{props.icon}</div> : null}
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="flex min-w-0 items-center gap-2">
            <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-5 text-v2-text-text-base [font-weight:530]">
              {props.title}
            </span>
            {props.badge ? <span class={WORKFLOW_BADGE}>{props.badge}</span> : null}
            {props.trailing ? <span class="shrink-0 text-[11px] leading-4 text-v2-text-text-muted">{props.trailing}</span> : null}
          </div>
          {props.subtitle ? (
            <div class="line-clamp-2 min-w-0 text-[12px] leading-4 text-v2-text-text-muted [font-weight:420]">{props.subtitle}</div>
          ) : null}
        </div>
      </button>
      {props.actions ? (
        <div
          data-component="workflow-entity-row-actions"
          class="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {props.actions}
        </div>
      ) : null}
    </div>
  )
}

/** Shared scrollable list container for workflow entity groups. */
export function WorkflowEntityList(props: {
  children: JSX.Element
  class?: string
  "aria-hidden"?: boolean | "true" | "false"
}) {
  return (
    <div
      data-component="workflow-entity-list"
      aria-hidden={props["aria-hidden"]}
      class={`flex min-w-0 flex-col gap-px pb-2 pt-1 ${props.class ?? ""}`}
    >
      {props.children}
    </div>
  )
}

/** Shared workflow list section header with optional right-side actions. */
export function WorkflowSectionHeader(props: {
  title: JSX.Element
  count?: JSX.Element
  actions?: JSX.Element
  class?: string
}) {
  return (
    <div
      data-component="workflow-section-header"
      class={`flex h-8 min-w-0 items-center justify-between gap-3 px-4 ${props.class ?? ""}`}
    >
      <div class="flex min-w-0 items-center gap-2">
        <div class={WORKFLOW_SECTION_LABEL}>{props.title}</div>
        {props.count !== undefined ? <span class={WORKFLOW_BADGE}>{props.count}</span> : null}
      </div>
      {props.actions ? <div class="flex shrink-0 items-center gap-1">{props.actions}</div> : null}
    </div>
  )
}

/** Shared workflow panel header for navigator, content, and detail panels. */
export function WorkflowPanelHeader(props: {
  title: JSX.Element
  badge?: JSX.Element
  leadingAction?: JSX.Element
  actions?: JSX.Element
  class?: string
}) {
  const hasBadge = () => props.badge !== undefined
  return (
    <div
      data-component="workflow-panel-header"
      class={`flex h-[42px] shrink-0 items-center justify-between gap-3 pl-4 pr-2 ${props.class ?? ""}`}
    >
      <div class="flex min-w-0 items-center gap-2">
        {props.leadingAction ? <div class="shrink-0">{props.leadingAction}</div> : null}
        <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-5 text-v2-text-text-base [font-weight:560]">
          {props.title}
        </div>
        {hasBadge() ? <span class={WORKFLOW_BADGE}>{props.badge}</span> : null}
      </div>
      {props.actions ? <div class="flex shrink-0 items-center gap-1">{props.actions}</div> : null}
    </div>
  )
}

/** Compact workflow segmented control for local view switching. */
export function WorkflowSegmentedControl(props: {
  options: readonly { value: string; label: JSX.Element }[]
  value: string
  onSelect: (value: string) => void
}) {
  return (
    <div
      data-component="workflow-segmented-control"
      class="flex min-w-0 items-center gap-1 rounded-[8px] bg-[var(--workflow-surface-muted)] p-0.5"
    >
      {props.options.map((option) => (
        <button
          type="button"
          data-component="workflow-segmented-control-option"
          data-selected={props.value === option.value ? "" : undefined}
          class="h-7 min-w-0 rounded-[6px] border-0 bg-transparent px-2 text-[12px] leading-4 text-v2-text-text-muted transition-[background-color,color,box-shadow] duration-[120ms] ease-in-out hover:bg-[var(--workflow-row-hover)] hover:text-v2-text-text-base data-[selected]:bg-[var(--workflow-control-selected)] data-[selected]:text-v2-text-text-base data-[selected]:shadow-[var(--workflow-elevation-minimal)] focus-visible:outline-none focus-visible:[box-shadow:0_0_0_1px_var(--v2-border-border-focus)] [font-weight:530]"
          onClick={() => props.onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
