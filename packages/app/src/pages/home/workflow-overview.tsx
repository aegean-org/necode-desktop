import { For } from "solid-js"
import { WORKFLOW_SURFACE_BUTTON } from "@/components/workflow-ui"
import { useLanguage } from "@/context/language"
import {
  workflowFilterTitleKey,
  workflowTaskFilterCount,
  type WorkflowTask,
  type WorkflowTaskFilter,
} from "./workflow-task"

const OVERVIEW_FILTERS = ["needs_action", "running", "done"] as const
const OVERVIEW_DOT_CLASS = {
  needs_action: "bg-icon-critical-base",
  running: "bg-icon-info-base",
  done: "bg-icon-success-base",
} satisfies Record<(typeof OVERVIEW_FILTERS)[number], string>

/** Compact task status strip for the main workflow navigator. */
export function HomeWorkflowOverview(props: {
  tasks: WorkflowTask[]
  filter: WorkflowTaskFilter
  onFilter: (filter: WorkflowTaskFilter) => void
}) {
  const language = useLanguage()

  return (
    <div class="grid min-w-0 grid-cols-3 gap-2" aria-label={language.t("home.tasks.overview")}>
      <For each={OVERVIEW_FILTERS}>
        {(filter) => (
          <button
            type="button"
            data-component="home-workflow-overview"
            data-selected={props.filter === filter ? "" : undefined}
            class={`flex min-w-0 cursor-default flex-col gap-1 px-3 py-2 text-left ${WORKFLOW_SURFACE_BUTTON}`}
            onClick={() => props.onFilter(filter)}
          >
            <span class="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-v2-text-text-muted [font-weight:530]">
              <span class={`size-1.5 shrink-0 rounded-full ${OVERVIEW_DOT_CLASS[filter]}`} />
              <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {language.t(workflowFilterTitleKey(filter))}
              </span>
            </span>
            <span class="text-[18px] leading-6 text-v2-text-text-base [font-weight:560]">
              {workflowTaskFilterCount(props.tasks, filter)}
            </span>
          </button>
        )}
      </For>
    </div>
  )
}
