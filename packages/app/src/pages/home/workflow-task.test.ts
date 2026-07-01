import { describe, expect, test } from "bun:test"
import type { PermissionRequest, QuestionRequest, Session, SessionStatus, Todo } from "@opencode-ai/sdk/v2/client"
import type { LocalProject } from "@/context/layout"
import {
  buildWorkflowTasks,
  buildWorkflowTasksFromStores,
  filterWorkflowTasks,
  groupWorkflowTasks,
  workflowFilterTitleKey,
  workflowGroupTitleKey,
  workflowTaskFilterCount,
  workflowTaskFilters,
  workflowStatusTitleKey,
  workflowTaskMeta,
} from "./workflow-task"

const homeSource = await Bun.file(new URL("../home.tsx", import.meta.url)).text()

const project = (name = "App") =>
  ({
    id: name,
    name,
    worktree: `/${name}`,
    expanded: false,
  }) as LocalProject

const session = (input: { id: string; title?: string; updated?: number; archived?: number; parentID?: string }) =>
  ({
    id: input.id,
    title: input.title ?? input.id,
    parentID: input.parentID,
    time: {
      created: input.updated ?? 1,
      updated: input.updated ?? 1,
      archived: input.archived,
    },
  }) as Session

const permission = (sessionID: string) =>
  ({
    id: `perm-${sessionID}`,
    sessionID,
    permission: "bash",
    patterns: ["*"],
    metadata: {},
    always: [],
  }) as PermissionRequest

const question = (sessionID: string) =>
  ({
    id: `question-${sessionID}`,
    sessionID,
    questions: [{ question: "Continue?", header: "Continue", options: [] }],
  }) as QuestionRequest

const todo = (status: string) => ({ content: status, status, priority: "medium" }) as Todo

describe("buildWorkflowTasks", () => {
  test("projects sessions into workflow statuses with attention first", () => {
    const tasks = buildWorkflowTasks({
      records: [
        { session: session({ id: "ready", updated: 10 }), project: project("App"), projectName: "App" },
        { session: session({ id: "busy", updated: 20 }), project: project("Core"), projectName: "Core" },
        { session: session({ id: "blocked", updated: 30 }), project: project("Core"), projectName: "Core" },
        { session: session({ id: "done", updated: 40 }), project: project("Docs"), projectName: "Docs" },
        {
          session: session({ id: "archived", updated: 50, archived: 51 }),
          project: project("Hidden"),
          projectName: "Hidden",
        },
        {
          session: session({ id: "child", updated: 60, parentID: "ready" }),
          project: project("Hidden"),
          projectName: "Hidden",
        },
      ],
      permission: { blocked: [permission("blocked")] },
      question: { blocked: [question("blocked")] },
      sessionStatus: { busy: { type: "busy" } },
      todo: {
        done: [todo("completed"), todo("cancelled")],
        ready: [todo("pending"), todo("completed")],
      },
    })

    expect(tasks.map((task) => [task.id, task.status])).toEqual([
      ["blocked", "needs_action"],
      ["busy", "running"],
      ["ready", "ready"],
      ["done", "done"],
    ])
    expect(tasks.find((task) => task.id === "ready")?.todoProgress).toEqual({ done: 1, total: 2 })
  })

  test("groups tasks by workflow priority", () => {
    const groups = groupWorkflowTasks(
      buildWorkflowTasks({
        records: [
          { session: session({ id: "a", updated: 1 }), project: project(), projectName: "App" },
          { session: session({ id: "b", updated: 2 }), project: project(), projectName: "App" },
          { session: session({ id: "c", updated: 3 }), project: project(), projectName: "App" },
          { session: session({ id: "d", updated: 4 }), project: project(), projectName: "App" },
        ],
        permission: { b: [permission("b")] },
        question: {},
        sessionStatus: { c: { type: "busy" } },
        todo: { d: [todo("completed")] },
      }),
    )

    expect(groups.map((group) => [group.id, group.tasks.map((task) => task.id)])).toEqual([
      ["needs_action", ["b"]],
      ["running", ["c"]],
      ["recent", ["a"]],
      ["done", ["d"]],
    ])
  })

  test("merges workflow state from multiple directory stores", () => {
    const tasks = buildWorkflowTasksFromStores({
      records: [
        { session: session({ id: "a", updated: 1 }), project: project("App"), projectName: "App" },
        { session: session({ id: "b", updated: 2 }), project: project("Core"), projectName: "Core" },
      ],
      stores: [
        {
          session_status: { a: { type: "busy" } as SessionStatus },
          todo: {},
          permission: {},
          question: {},
        },
        {
          session_status: {},
          todo: {},
          permission: { b: [permission("b")] },
          question: {},
        },
      ],
    })

    expect(tasks.map((task) => [task.id, task.status])).toEqual([
      ["b", "needs_action"],
      ["a", "running"],
    ])
  })

  test("exposes i18n keys for workflow group labels", () => {
    expect((["needs_action", "running", "recent", "done"] as const).map(workflowGroupTitleKey)).toEqual([
      "home.tasks.group.needsAction",
      "home.tasks.group.running",
      "home.tasks.group.recent",
      "home.tasks.group.done",
    ])
  })

  test("filters tasks for the workflow navigator", () => {
    const tasks = buildWorkflowTasks({
      records: [
        { session: session({ id: "ready", updated: 1 }), project: project(), projectName: "App" },
        { session: session({ id: "busy", updated: 2 }), project: project(), projectName: "App" },
        { session: session({ id: "blocked", updated: 3 }), project: project(), projectName: "App" },
      ],
      permission: { blocked: [permission("blocked")] },
      question: {},
      sessionStatus: { busy: { type: "busy" } },
      todo: {},
    })

    expect(filterWorkflowTasks(tasks, "all").map((task) => task.id)).toEqual(["blocked", "busy", "ready"])
    expect(filterWorkflowTasks(tasks, "needs_action").map((task) => task.id)).toEqual(["blocked"])
    expect(workflowTaskFilterCount(tasks, "running")).toBe(1)
    expect(workflowTaskFilterCount(tasks, "done")).toBe(0)
  })

  test("exposes i18n keys for workflow navigator filters", () => {
    expect(workflowTaskFilters().map(workflowFilterTitleKey)).toEqual([
      "home.tasks.filter.all",
      "home.tasks.group.needsAction",
      "home.tasks.group.running",
      "home.tasks.group.recent",
      "home.tasks.group.done",
    ])
  })

  test("exposes i18n keys for workflow status labels", () => {
    expect((["needs_action", "running", "ready", "done"] as const).map(workflowStatusTitleKey)).toEqual([
      "home.tasks.status.needsAction",
      "home.tasks.status.running",
      "home.tasks.status.ready",
      "home.tasks.status.done",
    ])
  })

  test("exposes task metadata in the same order as the home row", () => {
    expect(
      workflowTaskMeta({
        hasPermissionRequest: true,
        hasQuestion: true,
        todoProgress: { done: 1, total: 3 },
      }),
    ).toEqual([
      { id: "permission", i18nKey: "home.tasks.meta.permission" },
      { id: "question", i18nKey: "home.tasks.meta.question" },
      { id: "todo", i18nKey: "home.tasks.meta.todo", values: { done: 1, total: 3 } },
    ])
  })

  test("keeps task row metadata stable for workflow entity rows", () => {
    const tasks = buildWorkflowTasks({
      records: [{ session: session({ id: "ses_running", title: "Implement shell", updated: 10 }), project: project(), projectName: "App" }],
      permission: {},
      question: {},
      sessionStatus: { ses_running: { type: "busy" } },
      todo: {},
    })

    expect(tasks[0].id).toBe("ses_running")
    expect(tasks[0].title).toBe("Implement shell")
    expect(tasks[0].status).toBe("running")
    expect(workflowTaskMeta(tasks[0]).map((item) => item.id)).toEqual(["status", "updated"])
  })

  test("keeps home task row selection separate from opening sessions", () => {
    const rowSource = homeSource.slice(
      homeSource.indexOf("function HomeWorkflowTaskRow"),
      homeSource.indexOf("function HomeSessionSkeleton"),
    )
    const actionsSource = rowSource.slice(rowSource.indexOf("actions={"), rowSource.indexOf("onSelect="))

    expect(rowSource).toContain('data-component="home-workflow-task-row"')
    expect(actionsSource).toContain("props.openSession(props.task.session)")
    expect(rowSource).toContain("onSelect={props.previewTask}")
    expect(rowSource).not.toContain("props.previewTask()\n          props.openSession(props.task.session)")
  })
})
