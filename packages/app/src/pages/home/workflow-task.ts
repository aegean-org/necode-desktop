import type { PermissionRequest, QuestionRequest, Session, SessionStatus, Todo } from "@opencode-ai/sdk/v2/client"
import type { LocalProject } from "@/context/layout"

/** UI status derived from a session and its live workflow state. */
export type WorkflowTaskStatus = "needs_action" | "running" | "ready" | "done"

/** Home workflow row projected from an OpenCode session. */
export type WorkflowTask = {
  id: string
  status: WorkflowTaskStatus
  updatedAt: number
  pinnedAt?: number
  archivedAt?: number
  session: Session
  project: LocalProject
  projectName: string
  title: string
  hasPermissionRequest: boolean
  hasQuestion: boolean
  todoProgress?: {
    done: number
    total: number
  }
}

/** Ordered task group used by the home workflow list. */
export type WorkflowTaskGroup = {
  id: "pinned" | "needs_action" | "running" | "recent" | "done" | "archived"
  tasks: WorkflowTask[]
}

/** Left navigation filter for the home workflow view. */
export type WorkflowTaskFilter = "all" | WorkflowTaskGroup["id"] | "archived"

/** Minimal session record needed to build a home workflow task. */
export type WorkflowTaskRecord = {
  session: Session
  project: LocalProject
  projectName: string
}

/** Store slices needed to calculate workflow state for task rows. */
export type WorkflowTaskInput = {
  records: WorkflowTaskRecord[]
  sessionStatus: Record<string, SessionStatus | undefined>
  todo: Record<string, Todo[] | undefined>
  permission: Record<string, PermissionRequest[] | undefined>
  question: Record<string, QuestionRequest[] | undefined>
}

/** Directory store shape consumed by the workflow projection layer. */
export type WorkflowTaskStore = {
  session_status: Record<string, SessionStatus | undefined>
  todo: Record<string, Todo[] | undefined>
  permission: Record<string, PermissionRequest[] | undefined>
  question: Record<string, QuestionRequest[] | undefined>
}

const DONE_TODO_STATUSES = new Set(["completed", "cancelled"])
const STATUS_RANK: Record<WorkflowTaskStatus, number> = {
  needs_action: 0,
  running: 1,
  ready: 2,
  done: 3,
}
const GROUP_ORDER = ["pinned", "needs_action", "running", "recent", "done"] as const satisfies readonly WorkflowTaskGroup["id"][]
const FILTER_ORDER = ["all", ...GROUP_ORDER, "archived"] as const
const GROUP_TITLE_KEYS = {
  pinned: "home.tasks.filter.pinned",
  needs_action: "home.tasks.group.needsAction",
  running: "home.tasks.group.running",
  recent: "home.tasks.group.recent",
  done: "home.tasks.group.done",
  archived: "home.tasks.filter.archived",
} satisfies Record<WorkflowTaskGroup["id"], string>
const FILTER_TITLE_KEYS = {
  all: "home.tasks.filter.all",
  ...GROUP_TITLE_KEYS,
  archived: "home.tasks.filter.archived",
} satisfies Record<WorkflowTaskFilter, string>
const STATUS_TITLE_KEYS = {
  needs_action: "home.tasks.status.needsAction",
  running: "home.tasks.status.running",
  ready: "home.tasks.status.ready",
  done: "home.tasks.status.done",
} satisfies Record<WorkflowTaskStatus, string>

/** Translatable metadata badge shown next to a workflow task. */
export type WorkflowTaskMeta =
  | { id: "status"; status: WorkflowTaskStatus; i18nKey: (typeof STATUS_TITLE_KEYS)[WorkflowTaskStatus] }
  | { id: "updated"; updatedAt: number; i18nKey: "home.tasks.detail.updated" }
  | { id: "permission"; i18nKey: "home.tasks.meta.permission" }
  | { id: "question"; i18nKey: "home.tasks.meta.question" }
  | { id: "todo"; i18nKey: "home.tasks.meta.todo"; values: { done: number; total: number } }

/** Projects session records into task rows for the home workflow view. */
export function buildWorkflowTasks(input: WorkflowTaskInput): WorkflowTask[] {
  return input.records
    .filter((record) => !record.session.parentID && !record.session.time.archived)
    .map((record) => taskFromRecord(record, input))
    .sort(compareWorkflowTasks)
}

/** Projects archived root sessions for the dedicated archived workflow filter. */
export function buildArchivedWorkflowTasks(input: WorkflowTaskInput): WorkflowTask[] {
  return input.records
    .filter((record) => !record.session.parentID && !!record.session.time.archived)
    .map((record) => taskFromRecord(record, input))
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0) || b.updatedAt - a.updatedAt)
}

/** Projects session records by merging workflow state from all visible directory stores. */
export function buildWorkflowTasksFromStores(input: {
  records: WorkflowTaskRecord[]
  stores: WorkflowTaskStore[]
}): WorkflowTask[] {
  return buildWorkflowTasks({
    records: input.records,
    sessionStatus: mergeRecords(input.stores.map((store) => store.session_status)),
    todo: mergeRecords(input.stores.map((store) => store.todo)),
    permission: mergeRecords(input.stores.map((store) => store.permission)),
    question: mergeRecords(input.stores.map((store) => store.question)),
  })
}

/** Groups projected workflow tasks into the inbox ordering used by home. */
export function groupWorkflowTasks(tasks: WorkflowTask[]): WorkflowTaskGroup[] {
  return GROUP_ORDER.map((id) => ({
    id,
    tasks: tasks.filter((task) => taskGroupID(task) === id),
  })).filter((group) => group.tasks.length > 0)
}

/** Returns the ordered filters shown in the home workflow navigator. */
export function workflowTaskFilters() {
  return FILTER_ORDER
}

/** Filters workflow tasks for the selected home navigator item. */
export function filterWorkflowTasks(tasks: WorkflowTask[], filter: WorkflowTaskFilter, archived: WorkflowTask[] = []) {
  if (filter === "archived") return archived
  if (filter === "all") return tasks
  return tasks.filter((task) => taskGroupID(task) === filter)
}

/** Counts workflow tasks for the selected home navigator item. */
export function workflowTaskFilterCount(tasks: WorkflowTask[], filter: WorkflowTaskFilter, archived: WorkflowTask[] = []) {
  return filterWorkflowTasks(tasks, filter, archived).length
}

/** Returns the translation key for a home workflow group header. */
export function workflowGroupTitleKey(id: WorkflowTaskGroup["id"]) {
  return GROUP_TITLE_KEYS[id]
}

/** Returns the translation key for a home workflow navigator filter. */
export function workflowFilterTitleKey(filter: WorkflowTaskFilter) {
  return FILTER_TITLE_KEYS[filter]
}

/** Returns the translation key for a workflow task status. */
export function workflowStatusTitleKey(status: WorkflowTaskStatus) {
  return STATUS_TITLE_KEYS[status]
}

/** Returns ordered task metadata badges for the home workflow row. */
export function workflowTaskMeta(
  input: Pick<WorkflowTask, "hasPermissionRequest" | "hasQuestion" | "todoProgress"> &
    Partial<Pick<WorkflowTask, "status" | "updatedAt">>,
) {
  return [
    input.status ? ({ id: "status", status: input.status, i18nKey: STATUS_TITLE_KEYS[input.status] } as const) : undefined,
    input.updatedAt !== undefined
      ? ({ id: "updated", updatedAt: input.updatedAt, i18nKey: "home.tasks.detail.updated" } as const)
      : undefined,
    input.hasPermissionRequest
      ? ({ id: "permission", i18nKey: "home.tasks.meta.permission" } as const)
      : undefined,
    input.hasQuestion ? ({ id: "question", i18nKey: "home.tasks.meta.question" } as const) : undefined,
    input.todoProgress
      ? ({ id: "todo", i18nKey: "home.tasks.meta.todo", values: input.todoProgress } as const)
      : undefined,
  ].filter((meta): meta is WorkflowTaskMeta => Boolean(meta))
}

function taskFromRecord(record: WorkflowTaskRecord, input: WorkflowTaskInput): WorkflowTask {
  const hasPermissionRequest = hasItems(input.permission[record.session.id])
  const hasQuestion = hasItems(input.question[record.session.id])
  const progress = todoProgress(input.todo[record.session.id])
  const status = workflowStatus({
    hasPermissionRequest,
    hasQuestion,
    progress,
    sessionStatus: input.sessionStatus[record.session.id],
  })

  return {
    id: record.session.id,
    title: record.session.title,
    session: record.session,
    project: record.project,
    projectName: record.projectName,
    updatedAt: record.session.time.updated ?? record.session.time.created,
    ...(record.session.time.pinned ? { pinnedAt: record.session.time.pinned } : {}),
    ...(record.session.time.archived ? { archivedAt: record.session.time.archived } : {}),
    hasPermissionRequest,
    hasQuestion,
    status,
    ...(progress ? { todoProgress: progress } : {}),
  }
}

function workflowStatus(input: {
  hasPermissionRequest: boolean
  hasQuestion: boolean
  progress: WorkflowTask["todoProgress"] | undefined
  sessionStatus: SessionStatus | undefined
}): WorkflowTaskStatus {
  if (input.hasPermissionRequest || input.hasQuestion) return "needs_action"
  if (input.sessionStatus && input.sessionStatus.type !== "idle") return "running"
  if (input.progress && input.progress.done === input.progress.total) return "done"
  return "ready"
}

function todoProgress(todos: Todo[] | undefined): WorkflowTask["todoProgress"] | undefined {
  if (!todos?.length) return
  return {
    done: todos.filter((todo) => DONE_TODO_STATUSES.has(todo.status)).length,
    total: todos.length,
  }
}

function hasItems<T>(items: T[] | undefined) {
  return (items?.length ?? 0) > 0
}

function groupID(status: WorkflowTaskStatus): WorkflowTaskGroup["id"] {
  if (status === "needs_action" || status === "running" || status === "done") return status
  return "recent"
}

function taskGroupID(task: WorkflowTask): WorkflowTaskGroup["id"] {
  if (task.pinnedAt && !task.archivedAt) return "pinned"
  return groupID(task.status)
}

function compareWorkflowTasks(a: WorkflowTask, b: WorkflowTask) {
  if (a.pinnedAt || b.pinnedAt) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.updatedAt - a.updatedAt
}

function mergeRecords<T>(records: Array<Record<string, T | undefined>>) {
  return Object.assign({}, ...records)
}
