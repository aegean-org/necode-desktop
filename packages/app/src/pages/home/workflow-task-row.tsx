import type { Session } from "@opencode-ai/sdk/v2/client"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { DateTime } from "luxon"
import { createMemo, For, type JSX } from "solid-js"
import { WorkflowEntityRow } from "@/components/workflow-ui"
import { useLanguage } from "@/context/language"
import { WorkflowSessionActions } from "@/pages/session/workflow-session-actions"
import { sessionTitle } from "@/utils/session-title"
import { workflowStatusTitleKey, workflowTaskMeta, type WorkflowTask } from "./workflow-task"

const STATUS_DOT_CLASS = {
  needs_action: "bg-icon-critical-base",
  running: "bg-icon-info-base",
  ready: "bg-icon-weak-base",
  done: "bg-icon-success-base",
} satisfies Record<WorkflowTask["status"], string>

type HomeWorkflowTaskRowProps = {
  readonly task: WorkflowTask
  readonly icon: JSX.Element
  readonly selected: boolean
  readonly onPreview: () => void
  readonly onOpen: (session: Session) => void
  readonly onPin: () => void | Promise<void>
  readonly onUnpin: () => void | Promise<void>
  readonly onArchive: () => void | Promise<void>
  readonly onRestore: () => void | Promise<void>
  readonly onDelete: () => Promise<boolean>
}

/** Renders one Craft-style Home task row with shared session-management actions. */
export function HomeWorkflowTaskRow(props: HomeWorkflowTaskRowProps) {
  const language = useLanguage()
  const title = createMemo(() => sessionTitle(props.task.title) || props.task.id)

  return (
    <div
      data-component="home-workflow-task-row"
      data-status={props.task.status}
      aria-current={props.selected ? "page" : undefined}
      onFocusIn={props.onPreview}
      onPointerEnter={props.onPreview}
    >
      <WorkflowEntityRow
        rowID={props.task.id}
        selected={props.selected}
        title={<span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{title()}</span>}
        subtitle={<WorkflowTaskSubtitle task={props.task} />}
        icon={props.icon}
        trailing={DateTime.fromMillis(props.task.updatedAt).toRelative()}
        actions={
          <div class="flex items-center gap-0.5">
            <WorkflowSessionActions
              title={title()}
              pinned={!!props.task.pinnedAt}
              archived={!!props.task.archivedAt}
              onPin={props.onPin}
              onUnpin={props.onUnpin}
              onArchive={props.onArchive}
              onRestore={props.onRestore}
              onDelete={props.onDelete}
            />
            <IconButtonV2
              aria-label={language.t("home.tasks.detail.open")}
              title={language.t("home.tasks.detail.open")}
              variant="ghost-muted"
              size="small"
              icon={<IconV2 name="arrow-right" />}
              onClick={() => props.onOpen(props.task.session)}
            />
          </div>
        }
        onSelect={() => props.onOpen(props.task.session)}
        class="home-workflow-task-row"
      />
    </div>
  )
}

function WorkflowTaskSubtitle(props: { task: WorkflowTask }) {
  const language = useLanguage()
  const metadata = createMemo(() =>
    workflowTaskMeta(props.task).flatMap((meta) => {
      if (meta.id === "status" || meta.id === "updated") return []
      return meta.id === "todo" ? language.t(meta.i18nKey, meta.values) : language.t(meta.i18nKey)
    }),
  )

  return (
    <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span class="inline-flex min-w-0 items-center gap-1.5">
        <span class={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[props.task.status]}`} />
        <span>{language.t(workflowStatusTitleKey(props.task.status))}</span>
      </span>
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{props.task.projectName}</span>
      <For each={metadata()}>
        {(item) => <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item}</span>}
      </For>
    </span>
  )
}

