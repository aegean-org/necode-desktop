import type { Session } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { DateTime } from "luxon"
import { For, Show, createMemo } from "solid-js"
import { WORKFLOW_BADGE, WorkflowEntityList, WorkflowEntityRow, WorkflowPanelHeader } from "@/components/workflow-ui"
import { useLanguage } from "@/context/language"
import { sessionTitle } from "@/utils/session-title"
import { workflowStatusTitleKey, workflowTaskMeta, type WorkflowTask } from "../home/workflow-task"

/** Craft-style navigator kept beside the session detail panel. */
export function WorkflowSessionNavigator(props: {
  tasks: WorkflowTask[]
  activeID: string | undefined
  loading: boolean
  embedded?: boolean
  onOpenSession: (session: Session) => void
  onNewSession: () => void
}) {
  const language = useLanguage()

  return (
    <aside
      data-component="workflow-session-navigator"
      class={workflowSessionNavigatorClass(props.embedded)}
      aria-label={language.t("session.workflow.title")}
    >
      <WorkflowSessionNavigatorHeader count={props.tasks.length} onNewSession={props.onNewSession} />
      <WorkflowSessionNavigatorBody
        tasks={props.tasks}
        activeID={props.activeID}
        loading={props.loading}
        onOpenSession={props.onOpenSession}
      />
    </aside>
  )
}

function WorkflowSessionNavigatorHeader(props: { count: number; onNewSession: () => void }) {
  const language = useLanguage()

  return (
    <WorkflowPanelHeader
      title={language.t("session.workflow.title")}
      badge={props.count}
      actions={
        <ButtonV2
          type="button"
          variant="ghost-muted"
          size="small"
          icon="plus"
          class="h-7 px-2"
          onClick={props.onNewSession}
        >
          {language.t("command.session.new")}
        </ButtonV2>
      }
    />
  )
}

function WorkflowSessionNavigatorBody(props: {
  tasks: WorkflowTask[]
  activeID: string | undefined
  loading: boolean
  onOpenSession: (session: Session) => void
}) {
  const language = useLanguage()

  return (
    <ScrollView class="min-h-0 flex-1">
      <Show
        when={!props.loading}
        fallback={<div class="px-4 py-3 text-[13px] leading-5 text-v2-text-text-muted">{language.t("common.loading")}</div>}
      >
        <Show
          when={props.tasks.length > 0}
          fallback={<div class="px-4 py-3 text-[13px] leading-5 text-v2-text-text-muted">{language.t("session.workflow.empty")}</div>}
        >
          <WorkflowEntityList class="px-2">
            <For each={props.tasks}>
              {(task) => (
                <WorkflowSessionRow
                  task={task}
                  selected={props.activeID === task.id}
                  onOpenSession={props.onOpenSession}
                />
              )}
            </For>
          </WorkflowEntityList>
        </Show>
      </Show>
    </ScrollView>
  )
}

function WorkflowSessionRow(props: {
  task: WorkflowTask
  selected: boolean
  onOpenSession: (session: Session) => void
}) {
  const language = useLanguage()

  return (
    <WorkflowEntityRow
      rowID={props.task.id}
      selected={props.selected}
      title={sessionTitle(props.task.title) || props.task.id}
      subtitle={<WorkflowSessionSubtitle task={props.task} />}
      badge={language.t(workflowStatusTitleKey(props.task.status))}
      trailing={DateTime.fromMillis(props.task.updatedAt).toRelative() ?? undefined}
      onSelect={() => props.onOpenSession(props.task.session)}
      class="workflow-session-row"
    />
  )
}

function WorkflowSessionSubtitle(props: { task: WorkflowTask }) {
  const language = useLanguage()
  const metadata = createMemo(() => workflowTaskMeta(props.task).filter((meta) => meta.id !== "status" && meta.id !== "updated"))

  return (
    <span class="flex min-w-0 flex-wrap items-center gap-1.5">
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{props.task.projectName}</span>
      <For each={metadata()}>
        {(meta) => (
          <span class={WORKFLOW_BADGE}>
            {meta.id === "todo" ? language.t(meta.i18nKey, meta.values) : language.t(meta.i18nKey)}
          </span>
        )}
      </For>
    </span>
  )
}

function workflowSessionNavigatorClass(embedded: boolean | undefined) {
  if (embedded) return "flex h-full min-w-0 flex-col overflow-hidden"
  return "hidden h-full w-[320px] shrink-0 flex-col overflow-hidden rounded-[10px] bg-[var(--workflow-panel-base)] shadow-[var(--workflow-elevation-middle)] lg:flex"
}
