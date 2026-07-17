import type { Session } from "@opencode-ai/sdk/v2/client"
import { batch, createEffect, createMemo, For, Match, on, onCleanup, onMount, Show, Switch } from "solid-js"
import { makeEventListener } from "@solid-primitives/event-listener"
import { createStore } from "solid-js/store"
import { useQuery } from "@tanstack/solid-query"
import { Button } from "@opencode-ai/ui/button"
import { Logo } from "@opencode-ai/ui/logo"
import { Spinner } from "@opencode-ai/ui/spinner"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { getProjectAvatarVariant, useLayout, type LocalProject } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useDirectoryPicker } from "@/components/directory-picker"
import { DialogSelectServer, useServerManagementController } from "@/components/dialog-select-server"
import { DialogServerV2 } from "@/components/settings-v2/dialog-server-v2"
import { ServerConnection, useServer } from "@/context/server"
import { sessionHasOpenTab, useTabs } from "@/context/tabs"
import { useServerSync, type ServerSync } from "@/context/server-sync"
import { useLanguage } from "@/context/language"
import { useNotification } from "@/context/notification"
import {
  closeHomeProject,
  displayName,
  errorMessage,
  getProjectAvatarSource,
  homeProjectDirectories,
  homeProjectNavigation,
  type HomeProjectSelection,
  projectForSession,
  sortedRootSessions,
  toggleHomeProjectSelection,
} from "@/pages/layout/helpers"
import { useSessionTabAvatarState } from "@/pages/layout/project-avatar-state"
import { sessionTitle } from "@/utils/session-title"
import { pathKey } from "@/utils/path-key"
import { useGlobal } from "@/context/global"
import { useCommand } from "@/context/command"
import { useSettings } from "@/context/settings"
import { showToast } from "@/utils/toast"
import { ServerRowMenu } from "@/components/server/server-row-menu"
import { ServerHealthIndicator } from "@/components/server/server-row"
import { WorkflowShell } from "@/components/workflow-shell"
import {
  WORKFLOW_ENTITY_ROW,
  WORKFLOW_NAV_ROW,
  WORKFLOW_SECTION_LABEL,
  WorkflowEntityList,
  WorkflowEntityRow,
  WorkflowPanelHeader,
  WorkflowSectionHeader,
} from "@/components/workflow-ui"
import { type ServerHealth } from "@/utils/server-health"
import {
  buildArchivedWorkflowTasks,
  buildWorkflowTasksFromStores,
  filterWorkflowTasks,
  groupWorkflowTasks,
  workflowGroupTitleKey,
  type WorkflowTask,
  type WorkflowTaskFilter,
  type WorkflowTaskGroup,
} from "./home/workflow-task"
import { HomeWorkflowInspector } from "./home/workflow-inspector"
import { HomeWorkflowOverview } from "./home/workflow-overview"
import { HomeWorkflowNav } from "./home/workflow-sidebar"
import { HomeWorkflowTaskRow } from "./home/workflow-task-row"
import { createWorkflowSession, insertWorkflowSession } from "./session/workflow-new-session"
import { createSessionManagement } from "./session/session-management"

const HOME_SESSION_LIMIT = 64
const HOME_PROJECT_NAV_LABEL = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
type HomeSessionRecord = {
  session: Session
  project: LocalProject
  projectName: string
}

const HOME_SESSION_SEARCH_RESULTS_ID = "home-session-search-results"
const HOME_SEARCH_RESULT_ROW =
  `flex h-10 w-full shrink-0 items-center gap-2 py-2 pl-4 pr-6 ${WORKFLOW_ENTITY_ROW}`
const HOME_SEARCH_RESULT_TITLE =
  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-4 tracking-[-0.04px] text-v2-text-text-base [font-weight:530]"
const HOME_SEARCH_RESULT_META =
  "min-w-0 flex-[1_1_auto] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-4 tracking-[-0.04px] text-v2-text-text-muted [font-weight:440]"

let pendingHomeNavigation: { server: ServerConnection.Key; href: string } | undefined

function buildHomeSessionRecords(input: {
  sync: Pick<ServerSync, "child">
  projectDirectories: () => string[]
  projects: () => LocalProject[]
  projectByID: () => Map<string, LocalProject>
}) {
  return [
    ...new Map(
      input
        .projectDirectories()
        .flatMap((directory) => sortedRootSessions(input.sync.child(directory, { bootstrap: false })[0], Date.now()))
        .map((session) => [`${pathKey(session.directory)}:${session.id}`, session] as const),
    ).values(),
  ]
    .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
    .flatMap((session) => {
      const project = projectForSession(session, input.projects(), input.projectByID())
      if (!project) return []
      return {
        session,
        project,
        projectName: displayName(project),
      }
    })
}

function matchesHomeSessionSearch(record: HomeSessionRecord, query: string) {
  return `${record.session.title} ${record.projectName}`.toLowerCase().includes(query)
}

function homeSessionSearchKey(record: HomeSessionRecord) {
  return `${pathKey(record.session.directory)}:${record.session.id}`
}

export default function Home() {
  const settings = useSettings()
  return (
    <Show when={settings.general.newLayoutDesigns()} fallback={<LegacyHome />}>
      <HomeDesign />
    </Show>
  )
}

function HomeDesign() {
  const controller = createHomeWorkflowController()
  return <HomeWorkflowShell controller={controller} />
}

function homeProjectDirectoriesFromProject(project: LocalProject) {
  return [project.worktree, ...(project.sandboxes ?? [])]
}

function createHomeWorkflowController() {
  const context = createHomeWorkflowContext()
  const selection = createHomeWorkflowSelection(context)
  const tasks = createHomeWorkflowTasks({ context, selection })
  const actions = createHomeWorkflowActions({ context, selection, tasks })
  createHomeWorkflowEffects({ context, selection, tasks, actions })
  return { context, selection, tasks, actions }
}

type HomeWorkflowController = ReturnType<typeof createHomeWorkflowController>
type HomeWorkflowContext = ReturnType<typeof createHomeWorkflowContext>
type HomeWorkflowSelection = ReturnType<typeof createHomeWorkflowSelection>
type HomeWorkflowTasks = ReturnType<typeof createHomeWorkflowTasks>
type HomeWorkflowActions = ReturnType<typeof createHomeWorkflowActions>
type HomeSettingsTab = "general" | "shortcuts" | "servers" | "providers" | "models" | "mcp" | "skills" | "permissions"

const HOME_WORKFLOW_SYSTEM_ENTRIES = [
  { tab: "providers", label: "settings.providers.title", icon: "status" },
  { tab: "models", label: "settings.models.title", icon: "grid-plus" },
  { tab: "mcp", label: "settings.mcp.title", icon: "status" },
  { tab: "skills", label: "settings.skills.title", icon: "status-active" },
] as const satisfies readonly { tab: HomeSettingsTab; label: string; icon: string }[]

function createHomeWorkflowContext() {
  const sync = useServerSync()
  const layout = useLayout()
  const platform = usePlatform()
  const pickDirectory = useDirectoryPicker()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const language = useLanguage()
  const global = useGlobal()
  const command = useCommand()
  const notification = useNotification()
  const focusSessionSearch = { current: undefined as (() => void) | undefined }
  const [state, setState] = createStore({
    search: "",
    selection: { server: server.key } as HomeProjectSelection,
    searchFocused: false,
    activeTask: "",
    filter: "all" as WorkflowTaskFilter,
    activeSettingsTab: undefined as HomeSettingsTab | undefined,
  })

  return { sync, layout, platform, pickDirectory, dialog, navigate, server, language, global, command, notification, focusSessionSearch, state, setState }
}

function createHomeWorkflowSelection(context: HomeWorkflowContext) {
  const focusedServer = createMemo(
    () => context.global.servers.list().find((conn) => ServerConnection.key(conn) === context.state.selection.server) ?? context.server.current,
  )
  const focusedServerCtx = createMemo(() => {
    const conn = focusedServer()
    if (!conn) return
    return context.global.createServerCtx(conn)
  })
  const focusedSync = () => focusedServerCtx()?.sync ?? context.sync()
  const projects = createMemo(() => focusedServerCtx()?.projects.list() ?? context.layout.projects.list())
  const selectedProject = createMemo(() => projects().find((project) => project.worktree === context.state.selection.directory))
  const newSessionProject = createMemo(
    () =>
      selectedProject() ??
      projects().find((project) => project.worktree === focusedServerCtx()?.projects.last()) ??
      projects()[0],
  )
  const projectDirectories = createMemo(() => {
    const project = selectedProject()
    if (!project) return projects().flatMap(homeProjectDirectoriesFromProject)
    return homeProjectDirectoriesFromProject(project)
  })
  const search = createMemo(() => context.state.search.trim())
  const projectByID = createMemo(
    () => new Map(projects().flatMap((project) => (project.id ? [[project.id, project] as const] : []))),
  )

  return {
    focusedServer,
    focusedServerCtx,
    focusedSync,
    projects,
    selectedProject,
    newSessionProject,
    projectDirectories,
    search,
    projectByID,
  }
}

function createHomeWorkflowTasks(input: { context: HomeWorkflowContext; selection: HomeWorkflowSelection }) {
  const sessionLoad = useQuery(() => ({
    queryKey: ["home", "sessions", input.context.state.selection.server, ...input.selection.projectDirectories()] as const,
    queryFn: async () => {
      await Promise.all(
        input.selection
          .projectDirectories()
          .map((directory) => input.selection.focusedSync().project.loadSessions(directory, { limit: HOME_SESSION_LIMIT })),
      )
      return null
    },
  }))
  const archivedLoad = createHomeArchivedSessionLoad(input)
  const allRecords = createMemo(() =>
    buildHomeSessionRecords({
      sync: input.selection.focusedSync(),
      projectDirectories: input.selection.projectDirectories,
      projects: input.selection.projects,
      projectByID: input.selection.projectByID,
    }),
  )
  const records = createMemo(() => allRecords().slice(0, HOME_SESSION_LIMIT))
  const workflowStores = createMemo(() =>
    input.selection.projectDirectories().map((directory) => input.selection.focusedSync().child(directory, { bootstrap: false })[0]),
  )
  const workflowTasks = createMemo(() => buildWorkflowTasksFromStores({ records: records(), stores: workflowStores() }))
  const archivedRecords = createMemo(() =>
    (archivedLoad.data ?? []).flatMap((session) => {
      const project = projectForSession(session, input.selection.projects(), input.selection.projectByID())
      if (!project) return []
      return { session, project, projectName: displayName(project) }
    }),
  )
  const archivedWorkflowTasks = createMemo(() =>
    buildArchivedWorkflowTasks({
      records: archivedRecords(),
      sessionStatus: {},
      todo: {},
      permission: {},
      question: {},
    }),
  )
  const filteredWorkflowTasks = createMemo(() =>
    filterWorkflowTasks(workflowTasks(), input.context.state.filter, archivedWorkflowTasks()),
  )
  const workflowGroups = createMemo(() => {
    if (input.context.state.filter === "archived") {
      return filteredWorkflowTasks().length ? [{ id: "archived" as const, tasks: filteredWorkflowTasks() }] : []
    }
    return groupWorkflowTasks(filteredWorkflowTasks())
  })
  const activeTask = createMemo(
    () => filteredWorkflowTasks().find((task) => task.id === input.context.state.activeTask) ?? filteredWorkflowTasks()[0],
  )
  const searchResults = createMemo(() => {
    const query = input.selection.search().toLowerCase()
    if (!query) return []
    return allRecords().filter((record) => matchesHomeSessionSearch(record, query))
  })
  const searchOpen = createMemo(() => input.context.state.searchFocused && input.selection.search().length > 0)
  return {
    sessionLoad,
    archivedLoad,
    workflowTasks,
    archivedWorkflowTasks,
    filteredWorkflowTasks,
    workflowGroups,
    activeTask,
    searchResults,
    searchOpen,
  }
}

function createHomeArchivedSessionLoad(input: { context: HomeWorkflowContext; selection: HomeWorkflowSelection }) {
  return useQuery(() => ({
    queryKey: ["home", "archived-sessions", input.context.state.selection.server, ...input.selection.projectDirectories()] as const,
    enabled: !!input.selection.focusedServerCtx() && input.selection.projectDirectories().length > 0,
    queryFn: async () => {
      const ctx = input.selection.focusedServerCtx()
      if (!ctx) throw new Error("No server available for archived sessions")
      const result = await Promise.all(
        input.selection.projectDirectories().map((directory) =>
          ctx.sdk.client.experimental.session
            .list({ directory, roots: true, archived: true, limit: HOME_SESSION_LIMIT }, { throwOnError: true })
            .then((response) => {
              if (!response.data) throw new Error("Archived session list response missing data")
              return response.data
            }),
        ),
      )
      return result.flat()
    },
  }))
}

function createHomeWorkflowActions(input: {
  context: HomeWorkflowContext
  selection: HomeWorkflowSelection
  tasks: HomeWorkflowTasks
}) {
  const selectionActions = createHomeSelectionActions(input)
  const navigationActions = createHomeNavigationActions({ ...input, selectionActions })
  const projectActions = createHomeProjectActions({ ...input, selectionActions })
  const sessionActions = createHomeSessionActions(input)
  const closeSearch = () => {
    input.context.setState("search", "")
    input.context.setState("searchFocused", false)
  }
  return {
    ...selectionActions,
    ...navigationActions,
    ...projectActions,
    ...sessionActions,
    closeSearch,
    selectSearchSession: (session: Session) => {
      navigationActions.openSession(session)
      closeSearch()
    },
    bindSessionSearchFocus: (focus: () => void) => {
      input.context.focusSessionSearch.current = focus
    },
    setWorkflowFilter: (filter: WorkflowTaskFilter) => input.context.setState("filter", filter),
    previewTask: (id: string) => input.context.setState("activeTask", id),
  }
}

function createHomeSessionActions(input: {
  context: HomeWorkflowContext
  selection: HomeWorkflowSelection
  tasks: HomeWorkflowTasks
}) {
  const run = async (task: WorkflowTask, action: "pin" | "unpin" | "archive" | "restore" | "remove") => {
    try {
      const ctx = input.selection.focusedServerCtx()
      if (!ctx) throw new Error("No server available for session management")
      await createSessionManagement({ client: ctx.sdk.client, directory: task.session.directory })[action](task.id)
      await Promise.all([input.tasks.sessionLoad.refetch(), input.tasks.archivedLoad.refetch()])
      return true
    } catch (error) {
      showToast({
        title: input.context.language.t("common.requestFailed"),
        description: errorMessage(error, input.context.language.t("common.requestFailed")),
      })
      return false
    }
  }

  return {
    pinTask: (task: WorkflowTask) => run(task, "pin"),
    unpinTask: (task: WorkflowTask) => run(task, "unpin"),
    archiveTask: (task: WorkflowTask) => run(task, "archive"),
    restoreTask: (task: WorkflowTask) => run(task, "restore"),
    deleteTask: (task: WorkflowTask) => run(task, "remove"),
  }
}

function createHomeSelectionActions(input: { context: HomeWorkflowContext; selection: HomeWorkflowSelection }) {
  function setSelection(next: HomeProjectSelection) {
    batch(() => {
      if (input.context.state.selection.server !== next.server) input.context.setState("selection", "server", next.server)
      if (input.context.state.selection.directory !== next.directory) input.context.setState("selection", "directory", next.directory)
    })
  }

  return {
    setSelection,
    focusServer: (conn: ServerConnection.Any) => setSelection({ server: ServerConnection.key(conn) }),
    selectProject: (conn: ServerConnection.Any, directory: string) => {
      const key = ServerConnection.key(conn)
      if (!input.context.global.createServerCtx(conn).projects.list().some((project) => project.worktree === directory)) return
      setSelection(toggleHomeProjectSelection(input.context.state.selection, key, directory))
    },
    addProjects: (conn: ServerConnection.Any, directories: string[]) => {
      const directory = directories[0]
      if (!directory) return
      const ctx = input.context.global.createServerCtx(conn)
      directories.forEach(ctx.projects.open)
      ctx.projects.touch(directory)
      setSelection({ server: ServerConnection.key(conn), directory })
    },
  }
}

function createHomeNavigationActions(input: {
  context: HomeWorkflowContext
  selection: HomeWorkflowSelection
  selectionActions: ReturnType<typeof createHomeSelectionActions>
}) {
  const creatingSessions = new Set<string>()
  const navigateOnServer = (conn: ServerConnection.Any, href: string) => {
    const next = homeProjectNavigation(input.context.server.key, ServerConnection.key(conn), href)
    if (!next.server) return input.context.navigate(next.href)
    pendingHomeNavigation = next
    input.context.server.setActive(next.server)
  }
  const openProjectNewSession = async (conn: ServerConnection.Any, directory: string) => {
    const key = `${ServerConnection.key(conn)}:${directory}`
    if (creatingSessions.has(key)) return

    const ctx = input.context.global.createServerCtx(conn)
    ctx.projects.open(directory)
    ctx.projects.touch(directory)
    creatingSessions.add(key)
    try {
      await createWorkflowSession({
        directory,
        create: () => ctx.sdk.createClient({ directory, throwOnError: true }).session.create(),
        seed: (session) => {
          const [, setStore] = ctx.sync.child(directory, { bootstrap: false })
          setStore("session", (sessions: Session[]) => insertWorkflowSession(sessions, session))
        },
        navigate: (href) => navigateOnServer(conn, href),
      })
    } catch (error) {
      showToast({
        title: input.context.language.t("prompt.toast.sessionCreateFailed.title"),
        description: errorMessage(error, input.context.language.t("common.requestFailed")),
      })
    } finally {
      creatingSessions.delete(key)
    }
  }

  return {
    navigateOnServer,
    openProjectNewSession,
    openNewSession: () => {
      const conn = input.selection.focusedServer()
      const project = input.selection.newSessionProject()
      if (conn && project) void openProjectNewSession(conn, project.worktree)
    },
    openSession: (session: Session) => {
      const project = projectForSession(session, input.selection.projects(), input.selection.projectByID())
      const conn = input.selection.focusedServer()
      if (!conn) return
      const directory = project?.worktree ?? session.directory
      const ctx = input.context.global.createServerCtx(conn)
      ctx.projects.open(directory)
      ctx.projects.touch(directory)
      navigateOnServer(conn, `/${base64Encode(session.directory)}/session/${session.id}`)
    },
    chooseProject: (conn: ServerConnection.Any) => input.context.pickDirectory({
      server: conn,
      title: input.context.language.t("command.project.open"),
      multiple: true,
      onSelect: (result) => input.selectionActions.addProjects(conn, homeProjectDirectories(result)),
    }),
  }
}

function createHomeProjectActions(input: {
  context: HomeWorkflowContext
  selection: HomeWorkflowSelection
  selectionActions: ReturnType<typeof createHomeSelectionActions>
}) {
  return {
    editProject: (conn: ServerConnection.Any, project: LocalProject) => void import("@/components/dialog-edit-project").then((x) => {
      input.context.dialog.show(() => <x.DialogEditProject server={conn} project={project} />)
    }),
    closeProject: (conn: ServerConnection.Any, directory: string) => {
      const next = closeHomeProject(input.context.state.selection, ServerConnection.key(conn), input.context.global.createServerCtx(conn).projects, directory)
      if (next) input.selectionActions.setSelection(next)
    },
    clearNotifications: (conn: ServerConnection.Any, project: LocalProject) => {
      if (ServerConnection.key(conn) !== input.context.server.key) return
      homeProjectDirectoriesFromProject(project)
        .filter((directory) => input.context.notification.project.unseenCount(directory) > 0)
        .forEach((directory) => input.context.notification.project.markViewed(directory))
    },
    unseenCount: (conn: ServerConnection.Any, project: LocalProject) => {
      if (ServerConnection.key(conn) !== input.context.server.key) return 0
      return homeProjectDirectoriesFromProject(project).reduce(
        (total, directory) => total + input.context.notification.project.unseenCount(directory),
        0,
      )
    },
    openSettings: (tab?: HomeSettingsTab) => {
      input.context.setState("activeSettingsTab", tab)
      void import("@/components/settings-v2").then((x) => {
        input.context.dialog.show(() => <x.DialogSettings defaultTab={tab} />)
      })
    },
  }
}

function createHomeWorkflowEffects(input: {
  context: HomeWorkflowContext
  selection: HomeWorkflowSelection
  tasks: HomeWorkflowTasks
  actions: HomeWorkflowActions
}) {
  input.context.command.register("home", () => [{
    id: "home.tasks.search.focus",
    title: input.context.language.t("home.tasks.search.placeholder"),
    keybind: "mod+f",
    hidden: true,
    onSelect: () => input.context.focusSessionSearch.current?.(),
  }])

  createEffect(() => {
    const list = input.context.global.servers.list()
    if (list.some((conn) => ServerConnection.key(conn) === input.context.state.selection.server)) return
    const conn = list.find((conn) => ServerConnection.key(conn) === input.context.server.key) ?? list[0]
    if (conn) input.actions.setSelection({ server: ServerConnection.key(conn) })
  })

  createEffect(() => {
    const pending = pendingHomeNavigation
    if (!pending || pending.server !== input.context.server.key) return
    pendingHomeNavigation = undefined
    input.context.navigate(pending.href)
  })

  createEffect(() => {
    const next = input.tasks.activeTask()?.id ?? ""
    if (input.context.state.activeTask === next) return
    input.context.setState("activeTask", next)
  })
}

function HomeWorkflowShell(props: { controller: HomeWorkflowController }) {
  const controller = props.controller
  return (
    <WorkflowShell
      navigationOpen={controller.context.layout.workflowSidebar.opened()}
      left={<HomeWorkflowProjectColumn controller={controller} />}
      navigator={<HomeTaskNavigatorPanel controller={controller} />}
      center={
        <HomeWorkflowInspector
          task={controller.tasks.activeTask()}
          project={controller.selection.newSessionProject()}
          onOpenSession={controller.actions.openSession}
          onPin={async (task) => {
            await controller.actions.pinTask(task)
          }}
          onUnpin={async (task) => {
            await controller.actions.unpinTask(task)
          }}
          onArchive={async (task) => {
            await controller.actions.archiveTask(task)
          }}
          onRestore={async (task) => {
            await controller.actions.restoreTask(task)
          }}
          onDelete={controller.actions.deleteTask}
          onNewSession={controller.selection.newSessionProject() ? controller.actions.openNewSession : undefined}
        />
      }
      navigatorWidth={360}
    />
  )
}

function HomeWorkflowProjectColumn(props: { controller: HomeWorkflowController }) {
  const controller = props.controller
  return (
    <HomeProjectColumn
      projects={controller.selection.projects()}
      selected={controller.context.state.selection}
      focusServer={controller.actions.focusServer}
      selectProject={controller.actions.selectProject}
      openNewSession={controller.actions.openProjectNewSession}
      chooseProject={(conn) => void controller.actions.chooseProject(conn)}
      editProject={controller.actions.editProject}
      closeProject={controller.actions.closeProject}
      clearNotifications={controller.actions.clearNotifications}
      unseenCount={controller.actions.unseenCount}
      workflowTasks={controller.tasks.workflowTasks()}
      archivedWorkflowTasks={controller.tasks.archivedWorkflowTasks()}
      workflowFilter={controller.context.state.filter}
      setWorkflowFilter={controller.actions.setWorkflowFilter}
      activeTab={controller.context.state.activeSettingsTab}
      openSettings={controller.actions.openSettings}
      language={controller.context.language}
    />
  )
}

function HomeTaskNavigatorPanel(props: { controller: HomeWorkflowController }) {
  const controller = props.controller
  return (
    <section
      class="flex min-h-0 min-w-0 flex-1 flex-col px-5 pb-5 pt-3"
      aria-label={controller.context.language.t("home.tasks.title")}
    >
      <HomeTaskNavigatorHeader controller={controller} />
      <HomeWorkflowOverview
        tasks={controller.tasks.workflowTasks()}
        filter={controller.context.state.filter}
        onFilter={controller.actions.setWorkflowFilter}
      />
      <HomeTaskSearch controller={controller} />
      <HomeTaskGroups controller={controller} />
    </section>
  )
}

function HomeTaskNavigatorHeader(props: { controller: HomeWorkflowController }) {
  const controller = props.controller
  return (
    <WorkflowPanelHeader
      class="mb-3 !px-0"
      title={controller.context.language.t("home.tasks.title")}
      badge={controller.tasks.filteredWorkflowTasks().length}
      actions={
        <Show when={controller.selection.newSessionProject()}>
          <ButtonV2
            data-action="home-new-session"
            variant="ghost-muted"
            size="normal"
            icon="plus"
            class="h-7 px-2 [font-weight:530]"
            onClick={controller.actions.openNewSession}
          >
            {controller.context.language.t("command.session.new")}
          </ButtonV2>
        </Show>
      }
    />
  )
}

function HomeTaskSearch(props: { controller: HomeWorkflowController }) {
  const controller = props.controller
  return (
    <div class="mt-3">
      <HomeSessionSearch
        value={controller.context.state.search}
        placeholder={controller.context.language.t("home.tasks.search.placeholder")}
        open={controller.tasks.searchOpen()}
        loading={controller.tasks.sessionLoad.isLoading}
        results={controller.tasks.searchResults()}
        server={controller.context.state.selection.server}
        activeServer={controller.context.state.selection.server === controller.context.server.key}
        noResultsLabel={controller.context.language.t("home.tasks.search.noResults", { query: controller.selection.search() })}
        bindFocus={controller.actions.bindSessionSearchFocus}
        onInput={(value) => controller.context.setState("search", value)}
        onFocus={() => controller.context.setState("searchFocused", true)}
        onClose={controller.actions.closeSearch}
        onSelect={controller.actions.selectSearchSession}
      />
    </div>
  )
}

function HomeTaskGroups(props: { controller: HomeWorkflowController }) {
  const loading = () =>
    props.controller.context.state.filter === "archived"
      ? props.controller.tasks.archivedLoad.isLoading
      : props.controller.tasks.sessionLoad.isLoading
  return (
    <ScrollView class="mt-2 min-h-0 flex-1">
      <div class="flex flex-col gap-4">
        <Show
          when={!loading()}
          fallback={<HomeSessionSkeleton label={props.controller.context.language.t("common.loading")} />}
        >
          <HomeTaskGroupsContent controller={props.controller} />
        </Show>
      </div>
    </ScrollView>
  )
}

function HomeTaskGroupsContent(props: { controller: HomeWorkflowController }) {
  const controller = props.controller
  return (
    <Show
      when={controller.tasks.workflowGroups().length > 0}
      fallback={
        <HomeProjectEmptyState
          project={controller.selection.newSessionProject()}
          archived={controller.context.state.filter === "archived"}
          onNewSession={
            controller.context.state.filter !== "archived" && controller.selection.newSessionProject()
              ? controller.actions.openNewSession
              : undefined
          }
        />
      }
    >
      <For each={controller.tasks.workflowGroups()}>
        {(group) => <HomeTaskGroup group={group} controller={controller} />}
      </For>
    </Show>
  )
}

function HomeProjectEmptyState(props: { project: LocalProject | undefined; archived?: boolean; onNewSession?: () => void }) {
  const language = useLanguage()
  const title = createMemo(() => {
    if (props.archived) return language.t("home.tasks.empty.archived")
    if (!props.project) return language.t("home.tasks.empty")
    return language.t("home.tasks.empty.projectTitle", { project: displayName(props.project) })
  })

  return (
    <div data-component="home-project-empty-state" class="flex min-w-0 flex-col gap-4 rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-02 px-4 py-4">
      <div class="flex min-w-0 items-start gap-3">
        <Show when={props.project}>
          {(project) => <HomeProjectAvatar project={project()} />}
        </Show>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] leading-5 text-v2-text-text-base [font-weight:560]">
            {title()}
          </div>
          <p class="text-[13px] leading-5 text-v2-text-text-muted [font-weight:440]">
            {language.t(props.archived ? "home.tasks.empty.archivedDescription" : "home.tasks.empty.projectDescription")}
          </p>
          <Show when={props.project?.worktree}>
            {(directory) => (
              <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] leading-4 text-v2-text-text-faint">
                {directory()}
              </div>
            )}
          </Show>
        </div>
      </div>
      <Show when={props.onNewSession}>
        {(onNewSession) => (
          <ButtonV2 variant="neutral" size="normal" icon="plus" class="self-start" onClick={onNewSession()}>
            {language.t("command.session.new")}
          </ButtonV2>
        )}
      </Show>
    </div>
  )
}

function HomeTaskGroup(props: {
  group: WorkflowTaskGroup
  controller: HomeWorkflowController
}) {
  const controller = props.controller
  return (
    <div class="flex min-w-0 flex-col gap-2">
      <HomeSessionGroupHeader
        title={controller.context.language.t(workflowGroupTitleKey(props.group.id))}
        count={props.group.tasks.length}
      />
      <WorkflowEntityList class="!pb-1 !pt-0">
        <For each={props.group.tasks}>
          {(task) => (
            <HomeWorkflowTaskRow
              task={task}
              icon={
                <HomeSessionLeading
                  project={task.project}
                  session={task.session}
                  server={controller.context.state.selection.server}
                  activeServer={controller.context.state.selection.server === controller.context.server.key}
                />
              }
              selected={controller.tasks.activeTask()?.id === task.id}
              onPreview={() => controller.actions.previewTask(task.id)}
              onOpen={controller.actions.openSession}
              onPin={async () => {
                await controller.actions.pinTask(task)
              }}
              onUnpin={async () => {
                await controller.actions.unpinTask(task)
              }}
              onArchive={async () => {
                await controller.actions.archiveTask(task)
              }}
              onRestore={async () => {
                await controller.actions.restoreTask(task)
              }}
              onDelete={() => controller.actions.deleteTask(task)}
            />
          )}
        </For>
      </WorkflowEntityList>
    </div>
  )
}

type HomeProjectColumnProps = {
  projects: LocalProject[]
  selected: HomeProjectSelection
  focusServer: (server: ServerConnection.Any) => void
  selectProject: (server: ServerConnection.Any, directory: string) => void
  openNewSession: (server: ServerConnection.Any, directory: string) => void
  chooseProject: (server: ServerConnection.Any) => void
  editProject: (server: ServerConnection.Any, project: LocalProject) => void
  closeProject: (server: ServerConnection.Any, directory: string) => void
  clearNotifications: (server: ServerConnection.Any, project: LocalProject) => void
  unseenCount: (server: ServerConnection.Any, project: LocalProject) => number
  workflowTasks: WorkflowTask[]
  archivedWorkflowTasks: WorkflowTask[]
  workflowFilter: WorkflowTaskFilter
  setWorkflowFilter: (filter: WorkflowTaskFilter) => void
  activeTab?: HomeSettingsTab
  openSettings: (tab?: HomeSettingsTab) => void
  language: ReturnType<typeof useLanguage>
}

type HomeProjectColumnContext = {
  global: ReturnType<typeof useGlobal>
  dialog: ReturnType<typeof useDialog>
  controller: ReturnType<typeof useServerManagementController>
}

function HomeProjectColumn(props: HomeProjectColumnProps) {
  const global = useGlobal()
  const dialog = useDialog()
  const controller = useServerManagementController({ navigateOnAdd: false })
  const context = { global, dialog, controller }

  return (
    <aside
      class="flex min-h-0 min-w-0 flex-col gap-5 overflow-hidden px-3 pb-4 pt-3"
      aria-label={props.language.t("home.projects")}
    >
      <HomeWorkflowNav
        tasks={props.workflowTasks}
        archivedTasks={props.archivedWorkflowTasks}
        filter={props.workflowFilter}
        onFilter={props.setWorkflowFilter}
      />
      <HomeWorkflowSystemNav activeTab={props.activeTab} openSettings={props.openSettings} />
      <div class="mx-1 h-px bg-v2-border-border-muted" aria-hidden="true" />
      <div data-component="home-project-section" class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <HomeProjectColumnHeader column={props} global={global} />
        <div
          data-component="home-project-scroll"
          class="min-h-0 flex-1 overflow-y-auto"
        >
          <HomeProjectColumnBody column={props} context={context} />
        </div>
      </div>
      <HomeProjectColumnFooter language={props.language} openSettings={props.openSettings} />
    </aside>
  )
}

function HomeProjectColumnHeader(props: { column: HomeProjectColumnProps; global: ReturnType<typeof useGlobal> }) {
  return (
    <WorkflowSectionHeader
      class="!h-7 !px-1.5"
      title={props.column.language.t("home.projects")}
      actions={
        <Show when={props.global.servers.list().length === 1}>
          <IconButtonV2
            data-action="home-add-project"
            variant="ghost-muted"
            size="large"
            class="titlebar-icon [&_[data-slot=icon-svg]]:text-v2-icon-icon-muted"
            icon={<IconV2 name="folder-add-left" />}
            onClick={() => props.column.chooseProject(props.global.servers.list()[0]!)}
            aria-label={props.column.language.t("home.project.add")}
          />
        </Show>
      }
    />
  )
}

function HomeProjectColumnBody(props: { column: HomeProjectColumnProps; context: HomeProjectColumnContext }) {
  return (
    <Show
      when={props.context.global.servers.list().length > 1}
      fallback={<HomeProjectList {...props.column} server={props.context.global.servers.list()[0]!} />}
    >
      <For each={props.context.global.servers.list()}>
        {(server) => <HomeServerProjectGroup server={server} column={props.column} context={props.context} />}
      </For>
    </Show>
  )
}

function HomeServerProjectGroup(props: {
  server: ServerConnection.Any
  column: HomeProjectColumnProps
  context: HomeProjectColumnContext
}) {
  const key = ServerConnection.key(props.server)
  const healthy = () => !!props.context.global.servers.health[key]?.healthy
  const serverCtx = props.context.global.createServerCtx(props.server)
  return (
    <div class="flex max-h-[min(572px,calc(100vh_-_300px))] min-w-0 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <HomeServerRow
        server={props.server}
        selected={props.column.selected.server === key && !props.column.selected.directory}
        healthy={healthy()}
        health={props.context.global.servers.health[key]}
        controller={props.context.controller}
        focusServer={props.column.focusServer}
        chooseProject={props.column.chooseProject}
        openEdit={(server) => props.context.dialog.show(() => <DialogServerV2 mode="edit" server={server} />)}
        language={props.column.language}
      />
      <Show when={healthy()}>
        <div class="mx-3 h-px bg-v2-border-border-base" />
        <HomeProjectList {...props.column} server={props.server} projects={serverCtx.projects.list()} />
      </Show>
    </div>
  )
}

function HomeProjectColumnFooter(props: { language: ReturnType<typeof useLanguage>; openSettings: () => void }) {
  return (
    <div class="flex shrink-0 min-w-0 flex-col gap-1">
      <HomeProjectFooterButton icon="settings-gear" label={props.language.t("sidebar.settings")} onClick={() => props.openSettings()} />
    </div>
  )
}

function HomeWorkflowSystemNav(props: { activeTab?: HomeSettingsTab; openSettings: (tab: HomeSettingsTab) => void }) {
  const language = useLanguage()
  return (
    <section class="flex min-w-0 flex-col gap-2" aria-label={language.t("home.system.title")}>
      <WorkflowSectionHeader class="!h-7 !px-1.5" title={language.t("home.system.title")} />
      <div class="flex min-w-0 flex-col gap-1">
        <For each={HOME_WORKFLOW_SYSTEM_ENTRIES}>
          {(entry) => (
            <button
              type="button"
              data-component="home-workflow-system-entry"
              data-selected={props.activeTab === entry.tab ? "" : undefined}
              class={WORKFLOW_NAV_ROW}
              onClick={() => props.openSettings(entry.tab)}
            >
              <IconV2 name={entry.icon} size="small" />
              <span class={HOME_PROJECT_NAV_LABEL}>{language.t(entry.label)}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}

function HomeProjectFooterButton(props: { icon: "settings-gear"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      class={`${WORKFLOW_NAV_ROW} text-v2-text-text-faint [&>[data-slot=icon-svg]]:text-v2-icon-icon-muted`}
      onClick={props.onClick}
    >
      <IconV2 name={props.icon} size="small" />
      <span class={HOME_PROJECT_NAV_LABEL}>{props.label}</span>
    </button>
  )
}

function HomeServerRow(props: {
  server: ServerConnection.Any
  selected: boolean
  healthy: boolean
  health: ServerHealth | undefined
  controller: ReturnType<typeof useServerManagementController>
  focusServer: (server: ServerConnection.Any) => void
  chooseProject: (server: ServerConnection.Any) => void
  openEdit: (server: ServerConnection.Http) => void
  language: ReturnType<typeof useLanguage>
}) {
  const [state, setState] = createStore({ menuOpen: false })
  return (
    <div class="group/server relative flex h-7 min-w-0 items-center rounded-[6px]">
      <button
        type="button"
        class={`${WORKFLOW_NAV_ROW} pr-16 disabled:opacity-60`}
        data-selected={props.selected ? "" : undefined}
        disabled={!props.healthy}
        onClick={() => props.focusServer(props.server)}
      >
        <div class="flex size-4 shrink-0 items-center justify-center">
          <ServerHealthIndicator health={props.health} />
        </div>
        <span class="flex min-w-0 items-center gap-1">
          <span class={HOME_PROJECT_NAV_LABEL}>{props.server.displayName ?? new URL(props.server.http.url).host}</span>
          <Show when={props.server.label}>
            {(label) => (
              <span class="shrink-0 rounded-[3px] border border-v2-border-border-base px-1 py-0.5 text-[9px] leading-none text-v2-text-text-muted">
                {label()}
              </span>
            )}
          </Show>
        </span>
      </button>
      <div
        class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/server:opacity-100 focus-within:opacity-100 data-[menu=true]:opacity-100"
        data-menu={state.menuOpen}
      >
        <ServerRowMenu
          server={props.server}
          controller={props.controller}
          onEdit={props.openEdit}
          open={state.menuOpen}
          onOpenChange={(open) => setState("menuOpen", open)}
        />
        <IconButtonV2
          data-action="home-add-project"
          variant="ghost-muted"
          size="small"
          icon={<IconV2 name="folder-add-left" />}
          aria-label={props.language.t("home.project.add")}
          onClick={() => props.chooseProject(props.server)}
        />
      </div>
    </div>
  )
}

function HomeProjectList(props: {
  server: ServerConnection.Any
  projects: LocalProject[]
  selected: HomeProjectSelection
  selectProject: (server: ServerConnection.Any, directory: string) => void
  openNewSession: (server: ServerConnection.Any, directory: string) => void
  editProject: (server: ServerConnection.Any, project: LocalProject) => void
  closeProject: (server: ServerConnection.Any, directory: string) => void
  clearNotifications: (server: ServerConnection.Any, project: LocalProject) => void
  unseenCount: (server: ServerConnection.Any, project: LocalProject) => number
  language: ReturnType<typeof useLanguage>
}) {
  return (
    <div class="flex min-w-0 flex-col gap-1">
      <For each={props.projects}>
        {(project) => (
          <HomeProjectRow
            project={project}
            server={props.server}
            selected={
              props.selected.server === ServerConnection.key(props.server) &&
              props.selected.directory === project.worktree
            }
            unseenCount={props.unseenCount(props.server, project)}
            selectProject={props.selectProject}
            openNewSession={props.openNewSession}
            editProject={props.editProject}
            closeProject={props.closeProject}
            clearNotifications={props.clearNotifications}
            language={props.language}
          />
        )}
      </For>
    </div>
  )
}

function HomeProjectRow(props: {
  project: LocalProject
  server: ServerConnection.Any
  selected: boolean
  unseenCount: number
  selectProject: (server: ServerConnection.Any, directory: string) => void
  openNewSession: (server: ServerConnection.Any, directory: string) => void
  editProject: (server: ServerConnection.Any, project: LocalProject) => void
  closeProject: (server: ServerConnection.Any, directory: string) => void
  clearNotifications: (server: ServerConnection.Any, project: LocalProject) => void
  language: ReturnType<typeof useLanguage>
}) {
  const [state, setState] = createStore({ menuOpen: false })
  return (
    <div class="group/project relative flex h-7 min-w-0 items-center rounded-[6px]">
      <button
        type="button"
        data-component="home-project-row"
        class={`${WORKFLOW_NAV_ROW} pr-16`}
        data-selected={props.selected ? "" : undefined}
        aria-current={props.selected ? "page" : undefined}
        onClick={() => props.selectProject(props.server, props.project.worktree)}
      >
        <HomeProjectAvatar project={props.project} />
        <span class={HOME_PROJECT_NAV_LABEL}>{displayName(props.project)}</span>
      </button>
      <div
        class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/project:opacity-100 focus-within:opacity-100 data-[menu=true]:opacity-100"
        data-menu={state.menuOpen}
      >
        <IconButtonV2
          data-action="home-project-new-session"
          variant="ghost-muted"
          size="small"
          icon={<IconV2 name="plus" />}
          aria-label={props.language.t("command.session.new")}
          onClick={() => props.openNewSession(props.server, props.project.worktree)}
        />
        <MenuV2
          gutter={4}
          modal={false}
          placement="bottom-end"
          open={state.menuOpen}
          onOpenChange={(open) => setState("menuOpen", open)}
        >
          <MenuV2.Trigger
            as={IconButtonV2}
            data-action="home-project-menu"
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="outline-dots" />}
            aria-label={props.language.t("common.moreOptions")}
          />
          <MenuV2.Portal>
            <MenuV2.Content>
              <MenuV2.Item onSelect={() => props.openNewSession(props.server, props.project.worktree)}>
                {props.language.t("command.session.new")}
              </MenuV2.Item>
              <MenuV2.Item onSelect={() => props.editProject(props.server, props.project)}>
                {props.language.t("common.edit")}
              </MenuV2.Item>
              <MenuV2.Item
                disabled={props.unseenCount === 0}
                onSelect={() => props.clearNotifications(props.server, props.project)}
              >
                {props.language.t("sidebar.project.clearNotifications")}
              </MenuV2.Item>
              <MenuV2.Separator />
              <MenuV2.Item onSelect={() => props.closeProject(props.server, props.project.worktree)}>
                {props.language.t("project.removeFromNecode")}
              </MenuV2.Item>
            </MenuV2.Content>
          </MenuV2.Portal>
        </MenuV2>
      </div>
    </div>
  )
}

function HomeProjectAvatar(props: { project: LocalProject }) {
  const name = createMemo(() => displayName(props.project))
  return (
    <ProjectAvatar
      fallback={name()}
      src={getProjectAvatarSource(props.project.id, props.project.icon)}
      variant={getProjectAvatarVariant(props.project.icon?.color)}
    />
  )
}

function HomeSessionAvatar(props: { project: LocalProject; session: Session; activeServer: boolean }) {
  const directory = () => props.session.directory
  const sessionId = () => props.session.id
  const state = useSessionTabAvatarState(directory, sessionId, () => props.activeServer)
  return (
    <ProjectAvatar
      fallback={displayName(props.project)}
      src={getProjectAvatarSource(props.project.id, props.project.icon)}
      variant={getProjectAvatarVariant(props.project.icon?.color)}
      unread={state.unread()}
      loading={state.loading()}
    />
  )
}

function HomeSessionLeading(props: {
  project: LocalProject
  session: Session
  server: ServerConnection.Key
  activeServer: boolean
}) {
  const tabs = useTabs()
  const hasOpenTab = createMemo(() => sessionHasOpenTab(tabs.store, props.server, props.session))
  return (
    <div class="relative shrink-0">
      <Show when={hasOpenTab()}>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute top-1/2 h-[7px] w-[3px] -translate-y-1/2 rounded-[2px] bg-v2-background-bg-layer-04"
          style={{ right: "calc(100% + 12px)" }}
        />
      </Show>
      <HomeSessionAvatar project={props.project} session={props.session} activeServer={props.activeServer} />
    </div>
  )
}

function HomeSessionSearch(props: {
  value: string
  placeholder: string
  open: boolean
  loading: boolean
  results: HomeSessionRecord[]
  server: ServerConnection.Key
  activeServer: boolean
  noResultsLabel: string
  bindFocus: (focus: () => void) => void
  onInput: (value: string) => void
  onFocus: () => void
  onClose: () => void
  onSelect: (session: Session) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({ active: "" })
  let root: HTMLDivElement | undefined
  let input: HTMLInputElement | undefined
  let listRef: HTMLDivElement | undefined

  const focusInput = () => {
    input?.focus()
    props.onFocus()
  }

  onMount(() => {
    props.bindFocus(focusInput)
  })

  const syncActive = (results: HomeSessionRecord[]) => {
    if (results.length === 0) {
      setStore("active", "")
      return
    }
    if (!results.some((record) => homeSessionSearchKey(record) === store.active)) {
      setStore("active", homeSessionSearchKey(results[0]))
    }
  }

  createEffect(() => syncActive(props.results))

  createEffect(
    on(
      () => props.value,
      () => syncActive(props.results),
    ),
  )

  const scrollActiveIntoView = () => {
    const key = store.active
    if (!key || !listRef) return
    const element = listRef.querySelector<HTMLElement>(`[data-key="${key}"]`)
    element?.scrollIntoView({ block: "nearest" })
  }

  const moveActive = (delta: number) => {
    const results = props.results
    if (results.length === 0) return
    const index = results.findIndex((record) => homeSessionSearchKey(record) === store.active)
    const start = index === -1 ? 0 : index
    const next = (start + delta + results.length) % results.length
    setStore("active", homeSessionSearchKey(results[next]))
    scrollActiveIntoView()
  }

  const selectActive = () => {
    const record = props.results.find((item) => homeSessionSearchKey(item) === store.active)
    if (!record) return
    props.onSelect(record.session)
  }

  onCleanup(
    makeEventListener(document, "pointerdown", (event) => {
      if (!props.open) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (root?.contains(target)) return
      props.onClose()
    }),
  )

  return (
    <div class="w-full">
      <div ref={root} data-component="home-session-search" class="relative z-10 w-full">
        <Show when={props.open}>
          <div
            data-component="home-session-search-panel"
            class="absolute flex flex-col rounded-[12px] bg-[var(--workflow-panel-base)] shadow-[var(--workflow-elevation-middle)]"
            style={{
              top: "-6px",
              left: "-6px",
              width: "calc(100% + 14px)",
            }}
          >
            <div class="flex flex-col pt-9">
              <div id={HOME_SESSION_SEARCH_RESULTS_ID} role="listbox" class="flex flex-col gap-4 pt-4 pb-2">
                <Show
                  when={!props.loading}
                  fallback={
                    <div class="flex items-center justify-center px-4 py-3 text-v2-text-text-muted [font-weight:440]">
                      <Spinner class="size-4" />
                    </div>
                  }
                >
                  <Show
                    when={props.results.length > 0}
                    fallback={
                      <p class="my-1.5 px-4 text-[13px] leading-4 tracking-[-0.04px] text-v2-text-text-muted [font-weight:440]">
                        {props.noResultsLabel}
                      </p>
                    }
                  >
                    <div class="flex flex-col">
                      <p class={`my-1.5 px-4 ${WORKFLOW_SECTION_LABEL}`}>
                        {language.t("home.tasks.search.tasks")}
                      </p>
                      <div ref={listRef} class="flex max-h-80 flex-col gap-px overflow-y-auto">
                        <For each={props.results}>
                          {(record) => (
                            <HomeSessionSearchResultRow
                              record={record}
                              server={props.server}
                              activeServer={props.activeServer}
                              selected={store.active === homeSessionSearchKey(record)}
                              onHighlight={() => setStore("active", homeSessionSearchKey(record))}
                              onSelect={(session) => props.onSelect(session)}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </Show>
        <label
          class="relative z-20 flex h-9 w-full items-center gap-2 rounded-[6px] py-1 pl-3 pr-2 text-v2-icon-icon-muted transition-[background-color,box-shadow] duration-[120ms] ease-in-out"
          classList={{
            "bg-v2-background-bg-layer-03 focus-within:bg-v2-background-bg-layer-03 focus-within:shadow-[0_0_0_0.5px_var(--v2-border-border-focus),var(--v2-elevation-raised)]":
              !props.open,
            "bg-transparent shadow-[0_0_0_0.5px_var(--v2-border-border-focus)]": props.open,
          }}
        >
          <IconV2 name="magnifying-glass" />
          <input
            ref={input}
            class="relative z-20 min-w-0 flex-1 border-0 bg-transparent text-v2-text-text-base outline-0 [font-weight:440] placeholder:text-v2-text-text-faint"
            value={props.value}
            placeholder={props.placeholder}
            aria-label={props.placeholder}
            aria-expanded={props.open}
            aria-controls={HOME_SESSION_SEARCH_RESULTS_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              store.active && props.open ? `home-session-search-option-${store.active}` : undefined
            }
            onFocus={() => props.onFocus()}
            onInput={(event) => props.onInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                props.onClose()
                input?.blur()
                return
              }
              if (!props.open || props.results.length === 0) return
              if (event.altKey || event.metaKey) return
              if (event.key === "ArrowDown") {
                event.preventDefault()
                moveActive(1)
                return
              }
              if (event.key === "ArrowUp") {
                event.preventDefault()
                moveActive(-1)
                return
              }
              if (event.key === "Enter" && !event.isComposing) {
                event.preventDefault()
                selectActive()
              }
            }}
          />
          <Show when={props.value}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              class="relative z-20 shrink-0"
              icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
              aria-label={props.placeholder}
              onClick={() => {
                props.onClose()
                input?.focus()
              }}
            />
          </Show>
        </label>
      </div>
    </div>
  )
}

function HomeSessionSearchResultRow(props: {
  record: HomeSessionRecord
  server: ServerConnection.Key
  activeServer: boolean
  selected: boolean
  onHighlight: () => void
  onSelect: (session: Session) => void
}) {
  const title = createMemo(() => sessionTitle(props.record.session.title) || props.record.session.id)

  const key = () => homeSessionSearchKey(props.record)

  return (
    <button
      type="button"
      id={`home-session-search-option-${key()}`}
      data-key={key()}
      data-component="home-session-search-row"
      data-selected={props.selected ? "" : undefined}
      role="option"
      aria-selected={props.selected}
      class={HOME_SEARCH_RESULT_ROW}
      onMouseEnter={() => props.onHighlight()}
      onClick={() => props.onSelect(props.record.session)}
    >
      <HomeSessionLeading
        project={props.record.project}
        session={props.record.session}
        server={props.server}
        activeServer={props.activeServer}
      />
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <span class={`${HOME_SEARCH_RESULT_TITLE} ${props.record.projectName ? "max-w-[min(70%,480px)] flex-[0_1_auto]" : "flex-[1_1_auto]"}`}>
          {title()}
        </span>
        <Show when={props.record.projectName}>
          <span class={HOME_SEARCH_RESULT_META}>{props.record.projectName}</span>
        </Show>
      </div>
    </button>
  )
}

function HomeSessionGroupHeader(props: { title: string; count?: number; onNewSession?: () => void }) {
  const language = useLanguage()
  return (
    <WorkflowSectionHeader
      title={props.title}
      count={props.count}
      class="!h-6 !px-3"
      actions={
        props.onNewSession ? (
          <ButtonV2
            data-action="home-new-session"
            variant="ghost-muted"
            size="normal"
            icon="plus"
            class="h-7 px-2 [font-weight:530]"
            onClick={props.onNewSession}
          >
            {language.t("command.session.new")}
          </ButtonV2>
        ) : undefined
      }
    />
  )
}

function HomeSessionSkeleton(props: { label: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-4">
      <WorkflowSectionHeader title={props.label} />
      <WorkflowEntityList class="px-0" aria-hidden="true">
        <For each={[0, 1, 2, 3]}>{() => <div class="h-10 rounded-[6px] bg-[var(--workflow-surface-muted)] opacity-70" />}</For>
      </WorkflowEntityList>
    </div>
  )
}

function LegacyHome() {
  const sync = useServerSync()
  const platform = usePlatform()
  const pickDirectory = useDirectoryPicker()
  const dialog = useDialog()
  const navigate = useNavigate()
  const global = useGlobal()
  const server = useServer()
  const language = useLanguage()
  const homedir = createMemo(() => sync().data.path.home)
  const recent = createMemo(() => {
    return sync()
      .data.project.slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5)
  })

  const serverDotClass = createMemo(() => {
    const healthy = global.servers.health[server.key]?.healthy
    if (healthy === true) return "bg-icon-success-base"
    if (healthy === false) return "bg-icon-critical-base"
    return "bg-border-weak-base"
  })

  function openProject(server: ServerConnection.Any, directory: string) {
    const serverCtx = global.createServerCtx(server)
    serverCtx.projects.open(directory)
    serverCtx.projects.touch(directory)
    navigate(`/${base64Encode(directory)}`)
  }

  function chooseProject() {
    const s = server.current
    if (!s) return

    const resolve = (result: string | string[] | null) => {
      if (Array.isArray(result)) {
        for (const directory of result) {
          openProject(s, directory)
        }
      } else if (result) {
        openProject(s, result)
      }
    }

    pickDirectory({
      server: s,
      title: language.t("command.project.open"),
      multiple: true,
      onSelect: resolve,
    })
  }

  return (
    <div class="mx-auto mt-55 w-full md:w-auto px-4">
      <Logo class="md:w-xl opacity-12" />
      <Button
        size="large"
        variant="ghost"
        class="mt-4 mx-auto text-14-regular text-text-weak"
        onClick={() => dialog.show(() => <DialogSelectServer />)}
      >
        <div
          classList={{
            "size-2 rounded-full": true,
            [serverDotClass()]: true,
          }}
        />
        {server.name}
      </Button>
      <Switch>
        <Match when={sync().data.project.length > 0}>
          <div class="mt-20 w-full flex flex-col gap-4">
            <div class="flex gap-2 items-center justify-between pl-3">
              <div class="text-14-medium text-text-strong">{language.t("home.recentProjects")}</div>
              <Button icon="folder-add-left" size="normal" class="pl-2 pr-3" onClick={chooseProject}>
                {language.t("command.project.open")}
              </Button>
            </div>
            <ul class="flex flex-col gap-2">
              <For each={recent()}>
                {(project) => (
                  <Button
                    size="large"
                    variant="ghost"
                    class="text-14-mono text-left justify-between px-3"
                    onClick={() => openProject(server.current!, project.worktree)}
                  >
                    {project.worktree.replace(homedir(), "~")}
                    <div class="text-14-regular text-text-weak">
                      {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                    </div>
                  </Button>
                )}
              </For>
            </ul>
          </div>
        </Match>
        <Match when={!sync().ready}>
          <div class="mt-30 mx-auto flex flex-col items-center gap-3">
            <div class="text-12-regular text-text-weak">{language.t("common.loading")}</div>
            <Button class="px-3" onClick={chooseProject}>
              {language.t("command.project.open")}
            </Button>
          </div>
        </Match>
        <Match when={true}>
          <div class="mt-30 mx-auto flex flex-col items-center gap-3">
            <Icon name="folder-add-left" size="large" />
            <div class="flex flex-col gap-1 items-center justify-center">
              <div class="text-14-medium text-text-strong">{language.t("home.empty.title")}</div>
              <div class="text-12-regular text-text-weak">{language.t("home.empty.description")}</div>
            </div>
            <Button class="px-3 mt-1" onClick={chooseProject}>
              {language.t("command.project.open")}
            </Button>
          </div>
        </Match>
      </Switch>
    </div>
  )
}
