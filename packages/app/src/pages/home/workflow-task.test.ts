import { describe, expect, test } from "bun:test"
import type { PermissionRequest, QuestionRequest, Session, SessionStatus, Todo } from "@opencode-ai/sdk/v2/client"
import type { LocalProject } from "@/context/layout"
import {
  buildArchivedWorkflowTasks,
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
const inspectorSource = await Bun.file(new URL("./workflow-inspector.tsx", import.meta.url)).text()
const rowSource = await Bun.file(new URL("./workflow-task-row.tsx", import.meta.url)).text()
const v2IconSource = await Bun.file(new URL("../../../../ui/src/v2/components/icon.tsx", import.meta.url)).text()
const indexCssSource = await Bun.file(new URL("../../index.css", import.meta.url)).text()
const enSource = await Bun.file(new URL("../../i18n/en.ts", import.meta.url)).text()
const zhSource = await Bun.file(new URL("../../i18n/zh.ts", import.meta.url)).text()
const HOME_SOURCE_FUNCTION_LINE_LIMIT = 50

const project = (name = "App") =>
  ({
    id: name,
    name,
    worktree: `/${name}`,
    expanded: false,
  }) as LocalProject

const session = (input: {
  id: string
  title?: string
  updated?: number
  pinned?: number
  archived?: number
  parentID?: string
}) =>
  ({
    id: input.id,
    title: input.title ?? input.id,
    parentID: input.parentID,
    time: {
      created: input.updated ?? 1,
      updated: input.updated ?? 1,
      pinned: input.pinned,
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

  test("groups pinned tasks first without replacing their workflow status", () => {
    const tasks = buildWorkflowTasks({
      records: [
        { session: session({ id: "ready", updated: 2 }), project: project(), projectName: "App" },
        { session: session({ id: "pinned", updated: 1, pinned: 10 }), project: project(), projectName: "App" },
      ],
      permission: {},
      question: {},
      sessionStatus: {},
      todo: {},
    })

    expect(groupWorkflowTasks(tasks).map((group) => [group.id, group.tasks.map((task) => task.id)])).toEqual([
      ["pinned", ["pinned"]],
      ["recent", ["ready"]],
    ])
    expect(tasks.find((task) => task.id === "pinned")?.status).toBe("ready")
  })

  test("projects archived root sessions separately", () => {
    const tasks = buildArchivedWorkflowTasks({
      records: [
        {
          session: session({ id: "archived", updated: 2, archived: 3 }),
          project: project(),
          projectName: "App",
        },
        { session: session({ id: "active", updated: 1 }), project: project(), projectName: "App" },
      ],
      permission: {},
      question: {},
      sessionStatus: {},
      todo: {},
    })

    expect(tasks.map((task) => task.id)).toEqual(["archived"])
    expect(tasks[0]?.archivedAt).toBe(3)
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

    const archived = buildArchivedWorkflowTasks({
      records: [
        {
          session: session({ id: "archived", updated: 4, archived: 5 }),
          project: project(),
          projectName: "App",
        },
      ],
      permission: {},
      question: {},
      sessionStatus: {},
      todo: {},
    })

    expect(filterWorkflowTasks(tasks, "all", archived).map((task) => task.id)).toEqual(["blocked", "busy", "ready"])
    expect(filterWorkflowTasks(tasks, "needs_action").map((task) => task.id)).toEqual(["blocked"])
    expect(filterWorkflowTasks(tasks, "archived", archived).map((task) => task.id)).toEqual(["archived"])
    expect(workflowTaskFilterCount(tasks, "running")).toBe(1)
    expect(workflowTaskFilterCount(tasks, "done")).toBe(0)
  })

  test("exposes i18n keys for workflow navigator filters", () => {
    expect(workflowTaskFilters().map(workflowFilterTitleKey)).toEqual([
      "home.tasks.filter.all",
      "home.tasks.filter.pinned",
      "home.tasks.group.needsAction",
      "home.tasks.group.running",
      "home.tasks.group.recent",
      "home.tasks.group.done",
      "home.tasks.filter.archived",
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
    const actionsSource = rowSource.slice(rowSource.indexOf("actions={"), rowSource.indexOf("onSelect="))

    expect(rowSource).toContain('data-component="home-workflow-task-row"')
    expect(actionsSource).toContain("props.onOpen(props.task.session)")
    expect(rowSource).toContain("onSelect={props.onPreview}")
    expect(rowSource).not.toContain("props.onPreview()\n          props.onOpen(props.task.session)")
  })

  test("keeps home task rows using compact workflow actions", () => {
    expect(rowSource).toContain("WorkflowSessionActions")
    expect(rowSource).toContain("IconButtonV2")
    expect(rowSource).not.toContain('>{language.t("home.tasks.detail.open")}</ButtonV2>')
  })

  test("uses open-task icon semantics instead of edit semantics", () => {
    const headerSource = inspectorSource.slice(
      inspectorSource.indexOf("function InspectorHeader"),
      inspectorSource.indexOf("function InspectorEmptyState"),
    )

    expect(v2IconSource).toContain('"arrow-right":')
    expect(rowSource).toContain('icon={<IconV2 name="arrow-right" />}')
    expect(headerSource).toContain('icon={<IconV2 name="arrow-right" />}')
    expect(rowSource).not.toContain('name="edit"')
    expect(headerSource).not.toContain('name="edit"')
  })

  test("uses create-session icon semantics instead of edit semantics", () => {
    const taskHeaderSource = homeSource.slice(
      homeSource.indexOf("function HomeTaskNavigatorHeader"),
      homeSource.indexOf("function HomeTaskSearch"),
    )
    const projectRowSource = homeSource.slice(
      homeSource.indexOf("function HomeProjectRow"),
      homeSource.indexOf("function HomeProjectAvatar"),
    )
    const groupHeaderSource = homeSource.slice(
      homeSource.indexOf("function HomeSessionGroupHeader"),
      homeSource.indexOf("function HomeWorkflowTaskRow"),
    )
    const emptyStateSource = inspectorSource.slice(
      inspectorSource.indexOf("function InspectorEmptyState"),
      inspectorSource.indexOf("function InspectorTaskDetail"),
    )

    expect(v2IconSource).toContain("plus:")
    expect(taskHeaderSource).toContain('icon="plus"')
    expect(projectRowSource).toContain('icon={<IconV2 name="plus" />}')
    expect(groupHeaderSource).toContain('icon="plus"')
    expect(emptyStateSource).toContain('icon="plus"')
    expect(taskHeaderSource).not.toContain('icon="edit"')
    expect(projectRowSource).not.toContain('name="edit"')
    expect(groupHeaderSource).not.toContain('icon="edit"')
    expect(emptyStateSource).not.toContain('icon="edit"')
  })

  test("shows selected-project empty workflow state instead of a bare no-results row", () => {
    const groupsContentSource = homeSource.slice(
      homeSource.indexOf("function HomeTaskGroupsContent"),
      homeSource.indexOf("function HomeTaskGroup(props"),
    )
    const emptyStateSource = homeSource.slice(
      homeSource.indexOf("function HomeProjectEmptyState"),
      homeSource.indexOf("function HomeTaskGroup(props"),
    )
    const shellSource = homeSource.slice(
      homeSource.indexOf("function HomeWorkflowShell"),
      homeSource.indexOf("function HomeWorkflowProjectColumn"),
    )

    expect(groupsContentSource).toContain("HomeProjectEmptyState")
    expect(groupsContentSource).not.toContain("title={controller.context.language.t(\"home.tasks.empty\")}")
    expect(emptyStateSource).toContain("project: LocalProject | undefined")
    expect(emptyStateSource).toContain("props.project?.worktree")
    expect(emptyStateSource).toContain("home.tasks.empty.projectTitle")
    expect(emptyStateSource).toContain("home.tasks.empty.projectDescription")
    expect(emptyStateSource).toContain("command.session.new")
    expect(shellSource).toContain("project={controller.selection.newSessionProject()}")
  })

  test("shows selected-project context in the empty inspector state", () => {
    const inspectorPropsSource = inspectorSource.slice(
      inspectorSource.indexOf("export function HomeWorkflowInspector"),
      inspectorSource.indexOf("function InspectorHeader"),
    )
    const emptyStateSource = inspectorSource.slice(
      inspectorSource.indexOf("function InspectorEmptyState"),
      inspectorSource.indexOf("function InspectorTaskDetail"),
    )

    expect(inspectorPropsSource).toContain("project: LocalProject | undefined")
    expect(inspectorPropsSource).toContain("project={props.project}")
    expect(emptyStateSource).toContain("props.project?.worktree")
    expect(emptyStateSource).toContain("home.tasks.detail.emptyProjectTitle")
    expect(emptyStateSource).toContain("home.tasks.detail.emptyProjectDescription")
  })

  test("exposes project-empty workflow copy in English and Chinese", () => {
    for (const key of [
      "home.tasks.empty.projectTitle",
      "home.tasks.empty.projectDescription",
      "home.tasks.detail.emptyProjectTitle",
      "home.tasks.detail.emptyProjectDescription",
      "home.tasks.detail.emptyProjectPath",
    ]) {
      expect(enSource).toContain(`"${key}"`)
      expect(zhSource).toContain(`"${key}"`)
    }
  })

  test("exposes NeCode-backed system entries without Craft-only categories", () => {
    const systemEntriesSource = homeSource.slice(
      homeSource.indexOf("const HOME_WORKFLOW_SYSTEM_ENTRIES"),
      homeSource.indexOf("function createHomeWorkflowContext"),
    )

    expect(homeSource).toContain("HomeWorkflowSystemNav")
    expect(homeSource).toContain('data-component="home-workflow-system-entry"')
    expect(systemEntriesSource).toContain('tab: "providers"')
    expect(systemEntriesSource).toContain('tab: "models"')
    expect(systemEntriesSource).toContain('tab: "mcp"')
    expect(systemEntriesSource).toContain('tab: "skills"')
    expect(systemEntriesSource).not.toContain('tab: "general"')
    expect(systemEntriesSource).not.toContain('tab: "shortcuts"')
    expect(systemEntriesSource).not.toContain('tab: "permissions"')
    expect(systemEntriesSource).not.toContain('tab: "servers"')
    expect(homeSource).toContain("DialogSettings defaultTab={tab}")
    expect(enSource).toContain('"home.system.title"')
    expect(zhSource).toContain('"home.system.title"')
    expect(homeSource).not.toContain("Sources")
    expect(homeSource).not.toContain("Automations")
  })

  test("keeps the active system settings entry visibly selected", () => {
    expect(homeSource).toContain("activeSettingsTab")
    expect(homeSource).toContain("activeTab={controller.context.state.activeSettingsTab}")
    expect(homeSource).toContain('data-selected={props.activeTab === entry.tab ? "" : undefined}')
    expect(homeSource).toContain('input.context.setState("activeSettingsTab", tab)')
  })

  test("hides the home sidebar help entry until a real help destination exists", () => {
    const footerSource = homeSource.slice(
      homeSource.indexOf("function HomeProjectColumnFooter"),
      homeSource.indexOf("function HomeWorkflowSystemNav"),
    )

    expect(footerSource).not.toContain("sidebar.help")
    expect(footerSource).not.toContain("openHelp")
    expect(homeSource).not.toContain("openHelp")
    expect(homeSource).not.toContain("PRODUCT_FEEDBACK_URL")
  })

  test("keeps project list scrollable without hiding the settings footer", () => {
    const columnSource = homeSource.slice(
      homeSource.indexOf("function HomeProjectColumn"),
      homeSource.indexOf("function HomeProjectColumnHeader"),
    )
    const scrollSource = homeSource.slice(
      homeSource.indexOf('data-component="home-project-scroll"'),
      homeSource.indexOf("function HomeProjectColumnHeader"),
    )
    const footerSource = homeSource.slice(
      homeSource.indexOf("function HomeProjectColumnFooter"),
      homeSource.indexOf("function HomeWorkflowSystemNav"),
    )

    expect(columnSource).toContain('data-component="home-project-section"')
    expect(columnSource).toContain('data-component="home-project-scroll"')
    expect(scrollSource).toContain("overflow-y-auto")
    expect(scrollSource).toContain("flex-1")
    expect(scrollSource).not.toContain("[scrollbar-width:none]")
    expect(scrollSource).not.toContain("[&::-webkit-scrollbar]:hidden")
    expect(indexCssSource).toContain('[data-component="home-project-scroll"]:hover')
    expect(indexCssSource).toContain('[data-component="home-project-scroll"]:focus-within')
    expect(footerSource).toContain("shrink-0")
    expect(footerSource).toContain("sidebar.settings")
  })

  test("keeps the home inspector from regressing to dashboard cards", () => {
    const taskDetailSource = inspectorSource.slice(
      inspectorSource.indexOf("function InspectorTaskDetail"),
      inspectorSource.indexOf("function InspectorProgress"),
    )

    expect(taskDetailSource).not.toContain("grid-cols-3")
    expect(taskDetailSource).not.toContain('variant="contrast"')
  })

  test("keeps touched home workflow functions under the local line limit", () => {
    expect(topLevelFunctionNonblankLineCount(homeSource, "HomeDesign")).toBeLessThanOrEqual(
      HOME_SOURCE_FUNCTION_LINE_LIMIT,
    )
    expect(topLevelFunctionNonblankLineCount(homeSource, "HomeProjectColumn")).toBeLessThanOrEqual(
      HOME_SOURCE_FUNCTION_LINE_LIMIT,
    )
  })
})

function topLevelFunctionNonblankLineCount(source: string, name: string) {
  const start = new RegExp(`^function ${name}\\(`, "m").exec(source)
  expect(start).not.toBeNull()

  const rest = source.slice(start!.index + 1)
  const next = /^function [A-Za-z0-9_]+\(/m.exec(rest)
  expect(next).not.toBeNull()

  return source
    .slice(start!.index, start!.index + 1 + next!.index)
    .split(/\r?\n/)
    .filter((line) => line.trim()).length
}
