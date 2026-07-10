import type { Session } from "@opencode-ai/sdk/v2/client"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { DateTime } from "luxon"
import { For, Show, createMemo } from "solid-js"
import { WORKFLOW_BADGE, WorkflowEntityList, WorkflowEntityRow, WorkflowPanelHeader } from "@/components/workflow-ui"
import { useLanguage } from "@/context/language"
import { WorkflowSessionActions } from "@/pages/session/workflow-session-actions"
import { sessionTitle } from "@/utils/session-title"
import { workflowStatusTitleKey, workflowTaskMeta, type WorkflowTask, type WorkflowTaskStatus } from "../home/workflow-task"

const SESSION_STATUS_DOT_CLASS = {
  needs_action: "bg-icon-critical-base",
  running: "bg-icon-info-base",
  ready: "bg-icon-weak-base",
  done: "bg-icon-success-base",
} satisfies Record<WorkflowTaskStatus, string>

type WorkflowNavigatorActions = {
  onPin: (task: WorkflowTask) => void | Promise<void>
  onUnpin: (task: WorkflowTask) => void | Promise<void>
  onArchive: (task: WorkflowTask) => void | Promise<void>
  onRestore: (task: WorkflowTask) => void | Promise<void>
  onDelete: (task: WorkflowTask) => Promise<boolean>
}

/** Craft-style navigator kept beside the session detail panel. */
export function WorkflowSessionNavigator(props: WorkflowNavigatorActions & {
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
      <WorkflowSessionNavigatorBody {...props} />
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
        <IconButtonV2
          type="button"
          variant="ghost-muted"
          size="small"
          icon={<Icon name="plus" />}
          class="size-7 rounded-[7px]"
          onClick={props.onNewSession}
          aria-label={language.t("command.session.new")}
          title={language.t("command.session.new")}
        >
        </IconButtonV2>
      }
    />
  )
}

function WorkflowSessionNavigatorBody(props: WorkflowNavigatorActions & {
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
                  {...props}
                  task={task}
                  selected={props.activeID === task.id}
                />
              )}
            </For>
          </WorkflowEntityList>
        </Show>
      </Show>
    </ScrollView>
  )
}

function WorkflowSessionRow(props: WorkflowNavigatorActions & {
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
      trailing={DateTime.fromMillis(props.task.updatedAt).toRelative() ?? undefined}
      actions={
        <WorkflowSessionActions
          title={sessionTitle(props.task.title) || props.task.id}
          pinned={!!props.task.pinnedAt}
          archived={!!props.task.archivedAt}
          onPin={() => props.onPin(props.task)}
          onUnpin={() => props.onUnpin(props.task)}
          onArchive={() => props.onArchive(props.task)}
          onRestore={() => props.onRestore(props.task)}
          onDelete={() => props.onDelete(props.task)}
        />
      }
      onSelect={() => props.onOpenSession(props.task.session)}
      class="workflow-session-row"
    />
  )
}

function WorkflowSessionSubtitle(props: { task: WorkflowTask }) {
  const language = useLanguage()
  const metadata = createMemo(() => workflowTaskMeta(props.task).filter((meta) => meta.id !== "status" && meta.id !== "updated"))

  return (
    <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span class="inline-flex min-w-0 items-center gap-1.5">
        <span class={`size-1.5 shrink-0 rounded-full ${SESSION_STATUS_DOT_CLASS[props.task.status]}`} />
        <span>{language.t(workflowStatusTitleKey(props.task.status))}</span>
      </span>
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
