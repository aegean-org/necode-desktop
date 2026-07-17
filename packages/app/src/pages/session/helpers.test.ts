import { describe, expect, test } from "bun:test"
import { createMemo, createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import {
  createOpenReviewFile,
  createOpenSessionFileTab,
  createSessionTabs,
  focusTerminalById,
  getTabReorderIndex,
  nextSessionIDAfterRemoval,
  reviewFileOpenWith,
  shouldCenterSessionContent,
  shouldFocusTerminalOnKeyDown,
  shouldShowFileTree,
} from "./helpers"

const SOURCE_FUNCTION_LINE_LIMIT = 50

describe("session page initialization", () => {
  test("initializes interaction store before workflow memos read it", async () => {
    const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()
    const store = source.indexOf("const [store, setStore] = createStore({")
    const workflowFilter = source.indexOf("const filteredWorkflowSessionTasks = createMemo")

    expect(store).toBeGreaterThanOrEqual(0)
    expect(workflowFilter).toBeGreaterThanOrEqual(0)
    expect(store).toBeLessThan(workflowFilter)
  })

  test("wires workflow shell slots explicitly", async () => {
    const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

    expect(source).not.toContain('storageKey="session.workflow-shell.panels"')
    expect(source).toContain("const workflowRightPanelOpen = createMemo")
    expect(source).toContain("!!params.id && desktopSidePanelOpen()")
    expect(source).toContain("navigationOpen={layout.workflowSidebar.opened()}")
    expect(source).toContain("right={workflowRightPanelOpen() ? sidePanel(true) : undefined}")
  })

  test("keeps internal review tabs and external file opening separate", async () => {
    const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

    expect(source).toContain("const openReviewFile = createOpenReviewFile({")
    expect(source).toContain("onViewFile={openReviewFile}")
    expect(source).toContain("onOpenFileExternally=")
  })

  test("renders workflow navigator rows through shared entity rows", async () => {
    const source = await Bun.file(new URL("./workflow-session-navigator.tsx", import.meta.url)).text()

    expect(source).toContain("WorkflowEntityRow")
    expect(source).not.toContain("WORKFLOW_ENTITY_ROW")
  })

  test("wires shared session actions into workflow navigator rows", async () => {
    const source = await Bun.file(new URL("./workflow-session-navigator.tsx", import.meta.url)).text()

    expect(source).toContain("WorkflowSessionActions")
    expect(source).toContain("onPin={() => props.onPin(props.task)}")
    expect(source).toContain("onDelete={() => props.onDelete(props.task)}")
  })

  test("keeps workflow navigator rows aligned with compact entity metadata", async () => {
    const source = await Bun.file(new URL("./workflow-session-navigator.tsx", import.meta.url)).text()
    const rowSource = source.slice(source.indexOf("function WorkflowSessionRow"), source.indexOf("function WorkflowSessionSubtitle"))
    const headerSource = source.slice(source.indexOf("function WorkflowSessionNavigatorHeader"), source.indexOf("function WorkflowSessionNavigatorBody"))

    expect(rowSource).not.toContain("badge={")
    expect(headerSource).toContain("IconButtonV2")
    expect(headerSource).not.toContain('>{language.t("command.session.new")}</ButtonV2>')
  })

  test("keeps workflow side panel headers on v2 compact actions", async () => {
    const source = await Bun.file(new URL("./session-side-panel.tsx", import.meta.url)).text()
    const headerSource = source.slice(source.indexOf("function SessionWorkflowPanelHeader"), source.indexOf("function ReviewTabContent"))

    expect(headerSource).toContain("WorkflowOpenFileButton")
    expect(headerSource).not.toContain("actions={<OpenFileButton")
  })

  test("keeps the fourth workflow panel navigable back to review", async () => {
    const source = await Bun.file(new URL("./session-side-panel.tsx", import.meta.url)).text()
    const workflowUi = await Bun.file(new URL("../../components/workflow-ui.tsx", import.meta.url)).text()
    const workflowSource = source.slice(source.indexOf("function createWorkflowPanelState"), source.indexOf("function createSidePanelDrag"))
    const headerSource = source.slice(source.indexOf("function SessionWorkflowPanelHeader"), source.indexOf("function ReviewTabContent"))

    expect(workflowSource).toContain('base.session.tabs().setActive("review")')
    expect(headerSource).toContain("leadingAction=")
    expect(source).toContain('backLabel={props.state.language.t("common.goBack")}')
    expect(workflowUi).toContain('class="flex h-full shrink-0 items-center"')
  })

  test("keeps workflow composer dock from nesting legacy dock chrome", async () => {
    const source = await Bun.file(new URL("./composer/session-composer-region.tsx", import.meta.url)).text()

    expect(source).toContain("const workflowDock = createMemo")
    expect(source).toContain('"shrink-0 pb-3 bg-background-stronger": props.placement !== "inline" && !workflowDock()')
  })

  test("gates review panel chrome through side panel mode", async () => {
    const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

    expect(source).toContain("const reviewPanel = (workflow: boolean) =>")
    expect(source).toContain('"bg-[var(--workflow-panel-base)]": workflow')
    expect(source).toContain('"bg-background-stronger": !workflow')
    expect(source).toContain("reviewPanel={() => reviewPanel(embedded)}")
  })

  test("keeps session panel source section under the local line limit", async () => {
    const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

    expect(sourceSectionNonblankLineCount(source, "const sessionPanel = (workflow: boolean)", "const sidePanel =")).toBeLessThanOrEqual(
      SOURCE_FUNCTION_LINE_LIMIT,
    )
  })

  test("does not keep workflow-only width gate in legacy session sizing", async () => {
    const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

    expect(source).not.toContain("workflowSessionNavigatorOpen")
    expect(source).not.toContain("isWorkflowPanelWidth")
  })
})

describe("nextSessionIDAfterRemoval", () => {
  test("prefers the next session and then the previous session", () => {
    const sessions = [{ id: "a" }, { id: "b" }, { id: "c" }]

    expect(nextSessionIDAfterRemoval(sessions, "b")).toBe("c")
    expect(nextSessionIDAfterRemoval(sessions, "c")).toBe("b")
    expect(nextSessionIDAfterRemoval([{ id: "a" }], "a")).toBeUndefined()
  })
})

function sourceSectionNonblankLineCount(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source
    .slice(startIndex, endIndex)
    .split(/\r?\n/)
    .filter((line) => line.trim()).length
}

describe("shouldCenterSessionContent", () => {
  test("centers desktop session content in the workflow layout", () => {
    expect(shouldCenterSessionContent({ desktop: true, reviewOpen: false, workflowLayout: true })).toBe(true)
  })

  test("centers desktop sessions with no review panel", () => {
    expect(shouldCenterSessionContent({ desktop: true, reviewOpen: false, workflowLayout: false })).toBe(true)
    expect(shouldCenterSessionContent({ desktop: true, reviewOpen: false, workflowLayout: true })).toBe(true)
  })

  test("does not center mobile or review layouts", () => {
    expect(shouldCenterSessionContent({ desktop: false, reviewOpen: false, workflowLayout: false })).toBe(false)
    expect(shouldCenterSessionContent({ desktop: true, reviewOpen: true, workflowLayout: false })).toBe(false)
  })
})

describe("shouldShowFileTree", () => {
  test("does not reserve space for a disabled file tree", () => {
    expect(shouldShowFileTree({ visible: false, opened: true })).toBe(false)
    expect(shouldShowFileTree({ visible: true, opened: true })).toBe(true)
  })
})

describe("reviewFileOpenWith", () => {
  test("opens source files in a code editor", () => {
    expect(reviewFileOpenWith("src/index.ts", "windows")).toBe("code")
    expect(reviewFileOpenWith("src/index.ts", "linux")).toBe("code")
    expect(reviewFileOpenWith("src/index.ts", "macos")).toBe("Visual Studio Code")
  })

  test("leaves documents and media with their system application", () => {
    expect(reviewFileOpenWith("report.docx", "windows")).toBeUndefined()
    expect(reviewFileOpenWith("diagram.png", "windows")).toBeUndefined()
    expect(reviewFileOpenWith("demo.mp4", "windows")).toBeUndefined()
  })
})

describe("createOpenReviewFile", () => {
  test("opens and loads selected review file", () => {
    const calls: string[] = []
    const openReviewFile = createOpenReviewFile({
      showAllFiles: () => calls.push("show"),
      tabForPath: (path) => {
        calls.push(`tab:${path}`)
        return `file://${path}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      setActive: (tab) => calls.push(`active:${tab}`),
      loadFile: (path) => calls.push(`load:${path}`),
    })

    openReviewFile("src/a.ts")

    expect(calls).toEqual(["show", "load:src/a.ts", "tab:src/a.ts", "open:file://src/a.ts", "active:file://src/a.ts"])
  })
})

describe("createOpenSessionFileTab", () => {
  test("activates the opened file tab", () => {
    const calls: string[] = []
    const openTab = createOpenSessionFileTab({
      normalizeTab: (value) => {
        calls.push(`normalize:${value}`)
        return `file://${value}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      pathFromTab: (tab) => {
        calls.push(`path:${tab}`)
        return tab.slice("file://".length)
      },
      loadFile: (path) => calls.push(`load:${path}`),
      openReviewPanel: () => calls.push("review"),
      setActive: (tab) => calls.push(`active:${tab}`),
    })

    openTab("src/a.ts")

    expect(calls).toEqual([
      "normalize:src/a.ts",
      "open:file://src/a.ts",
      "path:file://src/a.ts",
      "load:src/a.ts",
      "review",
      "active:file://src/a.ts",
    ])
  })
})

describe("focusTerminalById", () => {
  test("focuses textarea when present", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-one"><div data-component="terminal"><textarea></textarea></div></div>`

    const focused = focusTerminalById("one")

    expect(focused).toBe(true)
    expect(document.activeElement?.tagName).toBe("TEXTAREA")
  })

  test("falls back to terminal element focus", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-two"><div data-component="terminal" tabindex="0"></div></div>`
    const terminal = document.querySelector('[data-component="terminal"]') as HTMLElement
    let pointerDown = false
    terminal.addEventListener("pointerdown", () => {
      pointerDown = true
    })

    const focused = focusTerminalById("two")

    expect(focused).toBe(true)
    expect(document.activeElement).toBe(terminal)
    expect(pointerDown).toBe(true)
  })
})

describe("shouldFocusTerminalOnKeyDown", () => {
  test("skips pure modifier keys", () => {
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Meta", metaKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Alt", altKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }))).toBe(false)
  })

  test("skips shortcut key combos", () => {
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "c", metaKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true }))).toBe(false)
  })

  test("keeps plain typing focused on terminal", () => {
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "a" }))).toBe(true)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "A", shiftKey: true }))).toBe(true)
  })
})

describe("getTabReorderIndex", () => {
  test("returns target index for valid drag reorder", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "c")).toBe(2)
  })

  test("returns undefined for unknown droppable id", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "missing")).toBeUndefined()
  })
})

describe("createSessionTabs", () => {
  test("normalizes the effective file tab", () => {
    createRoot((dispose) => {
      const [state] = createStore({
        active: undefined as string | undefined,
        all: ["file://src/a.ts", "context"],
      })
      const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
      const result = createSessionTabs({
        tabs,
        pathFromTab: (tab) => (tab.startsWith("file://") ? tab.slice("file://".length) : undefined),
        normalizeTab: (tab) => (tab.startsWith("file://") ? `norm:${tab.slice("file://".length)}` : tab),
      })

      expect(result.activeTab()).toBe("norm:src/a.ts")
      expect(result.activeFileTab()).toBe("norm:src/a.ts")
      expect(result.closableTab()).toBe("norm:src/a.ts")
      dispose()
    })
  })

  test("prefers context and review fallbacks when no file tab is active", () => {
    createRoot((dispose) => {
      const [state] = createStore({
        active: undefined as string | undefined,
        all: ["context"],
      })
      const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
      const result = createSessionTabs({
        tabs,
        pathFromTab: () => undefined,
        normalizeTab: (tab) => tab,
        review: () => true,
        hasReview: () => true,
      })

      expect(result.activeTab()).toBe("context")
      expect(result.closableTab()).toBe("context")
      dispose()
    })

    createRoot((dispose) => {
      const [state] = createStore({
        active: undefined as string | undefined,
        all: [],
      })
      const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
      const result = createSessionTabs({
        tabs,
        pathFromTab: () => undefined,
        normalizeTab: (tab) => tab,
        review: () => true,
        hasReview: () => true,
      })

      expect(result.activeTab()).toBe("review")
      expect(result.activeFileTab()).toBeUndefined()
      expect(result.closableTab()).toBeUndefined()
      dispose()
    })
  })
})
