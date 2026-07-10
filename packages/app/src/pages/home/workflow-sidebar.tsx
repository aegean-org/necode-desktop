import { For } from "solid-js"
import { WORKFLOW_NAV_ROW, WorkflowSectionHeader } from "@/components/workflow-ui"
import { useLanguage } from "@/context/language"
import {
  workflowFilterTitleKey,
  workflowTaskFilterCount,
  workflowTaskFilters,
  type WorkflowTask,
  type WorkflowTaskFilter,
} from "./workflow-task"

const FILTER_DOT_CLASS = {
  all: "bg-v2-icon-icon-accent",
  pinned: "bg-v2-icon-icon-warning",
  needs_action: "bg-icon-critical-base",
  running: "bg-icon-info-base",
  recent: "bg-icon-weak-base",
  done: "bg-icon-success-base",
  archived: "bg-v2-icon-icon-muted",
} satisfies Record<WorkflowTaskFilter, string>

/** Left-side workflow navigator for OpenCode task/status navigation. */
export function HomeWorkflowNav(props: {
  tasks: WorkflowTask[]
  archivedTasks?: WorkflowTask[]
  filter: WorkflowTaskFilter
  onFilter: (filter: WorkflowTaskFilter) => void
}) {
  const language = useLanguage()

  return (
    <section class="flex min-w-0 flex-col gap-2" aria-label={language.t("home.tasks.workflow")}>
      <WorkflowSectionHeader
        class="!h-7 !px-1.5"
        title={language.t("home.tasks.workflow")}
        count={props.tasks.length}
      />
      <div class="flex min-w-0 flex-col gap-1">
        <For each={workflowTaskFilters()}>
          {(filter) => (
            <button
              type="button"
              data-component="home-workflow-filter"
              data-selected={props.filter === filter ? "" : undefined}
              class={WORKFLOW_NAV_ROW}
              onClick={() => props.onFilter(filter)}
            >
              <span class={`size-2 shrink-0 rounded-full ${FILTER_DOT_CLASS[filter]}`} />
              <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {language.t(workflowFilterTitleKey(filter))}
              </span>
              <span class="shrink-0 text-[11px] leading-4 text-v2-text-text-muted [font-weight:530]">
                {workflowTaskFilterCount(props.tasks, filter, props.archivedTasks)}
              </span>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}
