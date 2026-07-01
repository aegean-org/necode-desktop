import type { Session } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DateTime } from "luxon"
import { createMemo, For, Show, type JSX } from "solid-js"
import { WORKFLOW_BADGE, WORKFLOW_SURFACE_CARD } from "@/components/workflow-ui"
import { useLanguage } from "@/context/language"
import { sessionTitle } from "@/utils/session-title"
import {
  workflowStatusTitleKey,
  workflowTaskMeta,
  type WorkflowTask,
  type WorkflowTaskMeta,
  type WorkflowTaskStatus,
} from "./workflow-task"

const STATUS_DOT_CLASS = {
  needs_action: "bg-icon-critical-base",
  running: "bg-icon-info-base",
  ready: "bg-icon-weak-base",
  done: "bg-icon-success-base",
} satisfies Record<WorkflowTaskStatus, string>

/** Right-side task context panel for the OpenCode home workflow. */
export function HomeWorkflowInspector(props: {
  task: WorkflowTask | undefined
  onOpenSession: (session: Session) => void
  onNewSession?: () => void
}) {
  const language = useLanguage()
  const title = createMemo(() => {
    const task = props.task
    if (!task) return language.t("home.tasks.detail.emptyTitle")
    return sessionTitle(task.title) || task.id
  })
  const metadata = createMemo(() => (props.task ? workflowTaskMeta(props.task) : []))
  const updated = createMemo(() => {
    const task = props.task
    if (!task) return ""
    return DateTime.fromMillis(task.updatedAt).toRelative()
  })
  const signalMetadata = createMemo(() => metadata().filter(isWorkflowSignalMeta))
  const progress = createMemo(() => {
    const task = props.task
    if (!task?.todoProgress) return language.t("home.tasks.detail.noProgress")
    return language.t("home.tasks.meta.todo", task.todoProgress)
  })
  const progressPercent = createMemo(() => {
    const task = props.task
    if (!task?.todoProgress) return 0
    return Math.round((task.todoProgress.done / task.todoProgress.total) * 100)
  })

  return (
    <aside
      class="flex min-h-0 min-w-0 flex-col px-5 pb-5 pt-3"
      aria-label={language.t("home.tasks.detail.title")}
    >
      <div class="flex min-h-0 flex-1 flex-col gap-5">
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <div class="text-v2-text-text-muted [font-weight:440]">{language.t("home.tasks.detail.title")}</div>
            <h2 class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[18px] leading-6 text-v2-text-text-base [font-weight:560]">
              {title()}
            </h2>
          </div>
          <Show when={props.task}>
            {(task) => (
              <ButtonV2 variant="ghost-muted" size="normal" icon="edit" onClick={() => props.onOpenSession(task().session)}>
                {language.t("home.tasks.detail.open")}
              </ButtonV2>
            )}
          </Show>
        </div>
        <Show
          when={props.task}
          fallback={
            <div class="flex min-h-0 flex-1 flex-col justify-between gap-4">
              <p class="text-[13px] leading-5 text-v2-text-text-muted [font-weight:440]">
                {language.t("home.tasks.detail.emptyDescription")}
              </p>
              <Show when={props.onNewSession}>
                {(onNewSession) => (
                  <ButtonV2 variant="neutral" size="normal" icon="edit" onClick={onNewSession()}>
                    {language.t("command.session.new")}
                  </ButtonV2>
                )}
              </Show>
            </div>
          }
        >
          {(task) => (
            <div class="flex min-h-0 flex-1 flex-col justify-between gap-5">
              <div class="flex min-w-0 flex-col gap-5">
                <div class="grid min-w-0 grid-cols-3 gap-2">
                  <InspectorMetric label={language.t("home.tasks.detail.status")}>
                    <span class="inline-flex min-w-0 items-center gap-1.5">
                      <span class={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[task().status]}`} />
                      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {language.t(workflowStatusTitleKey(task().status))}
                      </span>
                    </span>
                  </InspectorMetric>
                  <InspectorMetric label={language.t("home.tasks.detail.updated")}>{updated()}</InspectorMetric>
                  <InspectorMetric label={language.t("home.tasks.detail.progress")}>{progress()}</InspectorMetric>
                </div>

                <Show when={task().todoProgress}>
                  <div class={`flex min-w-0 flex-col gap-2 px-3 py-2 ${WORKFLOW_SURFACE_CARD}`}>
                    <div class="flex min-w-0 items-center justify-between gap-3 text-[12px] leading-4">
                      <span class="text-v2-text-text-muted [font-weight:440]">
                        {language.t("home.tasks.detail.progress")}
                      </span>
                      <span class="text-v2-text-text-base [font-weight:560]">{progressPercent()}%</span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-[var(--workflow-row-hover)]">
                      <div
                        class="h-full rounded-full bg-v2-icon-icon-accent"
                        style={{ width: `${progressPercent()}%` }}
                      />
                    </div>
                  </div>
                </Show>

                <div class="flex min-w-0 flex-col gap-2">
                  <div class="text-[12px] leading-4 text-v2-text-text-muted [font-weight:440]">
                    {language.t("home.tasks.detail.signals")}
                  </div>
                  <Show
                    when={signalMetadata().length > 0}
                    fallback={
                      <div class={`px-3 py-2 text-[13px] leading-5 text-v2-text-text-muted [font-weight:440] ${WORKFLOW_SURFACE_CARD}`}>
                        {language.t("home.tasks.detail.noSignals")}
                      </div>
                    }
                  >
                    <div class="flex flex-wrap gap-2">
                      <For each={signalMetadata()}>
                        {(meta) => (
                          <span class={`${WORKFLOW_BADGE} !px-2.5 !py-1 text-v2-text-text-base`}>
                            {meta.id === "todo" ? language.t(meta.i18nKey, meta.values) : language.t(meta.i18nKey)}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                <div class="flex min-w-0 flex-col gap-2">
                  <div class="text-[12px] leading-4 text-v2-text-text-muted [font-weight:440]">
                    {language.t("home.tasks.detail.context")}
                  </div>
                  <div class={`flex min-w-0 flex-col gap-px overflow-hidden ${WORKFLOW_SURFACE_CARD}`}>
                    <InspectorRow label={language.t("home.tasks.detail.project")}>{task().projectName}</InspectorRow>
                    <InspectorRow label={language.t("home.tasks.detail.directory")}>
                      {task().session.directory}
                    </InspectorRow>
                    <InspectorRow label={language.t("home.tasks.detail.session")}>{task().id}</InspectorRow>
                  </div>
                </div>
              </div>

              <ButtonV2 variant="contrast" size="normal" icon="edit" onClick={() => props.onOpenSession(task().session)}>
                {language.t("home.tasks.detail.open")}
              </ButtonV2>
            </div>
          )}
        </Show>
      </div>
    </aside>
  )
}

type WorkflowSignalMeta = Extract<WorkflowTaskMeta, { id: "permission" | "question" | "todo" }>

function isWorkflowSignalMeta(meta: WorkflowTaskMeta): meta is WorkflowSignalMeta {
  return meta.id === "permission" || meta.id === "question" || meta.id === "todo"
}

function InspectorRow(props: { label: string; children: JSX.Element }) {
  return (
    <div class="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-[13px] leading-5">
      <div class="text-v2-text-text-muted [font-weight:440]">{props.label}</div>
      <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-base [font-weight:530]">
        {props.children}
      </div>
    </div>
  )
}

function InspectorMetric(props: { label: string; children: JSX.Element }) {
  return (
    <div class={`flex min-w-0 flex-col gap-1 px-3 py-2 ${WORKFLOW_SURFACE_CARD}`}>
      <div class="text-[11px] leading-4 text-v2-text-text-muted [font-weight:440]">{props.label}</div>
      <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-5 text-v2-text-text-base [font-weight:560]">
        {props.children}
      </div>
    </div>
  )
}
