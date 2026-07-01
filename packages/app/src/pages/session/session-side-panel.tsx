import { For, Match, Show, Switch, createEffect, createMemo, onCleanup, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { Tabs } from "@opencode-ai/ui/tabs"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { Mark } from "@opencode-ai/ui/logo"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import { WORKFLOW_BADGE, WorkflowPanelHeader, WorkflowSegmentedControl } from "@/components/workflow-ui"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { useDialog } from "@opencode-ai/ui/context/dialog"

import FileTree from "@/components/file-tree"
import { SessionContextUsage } from "@/components/session-context-usage"
import { SessionContextTab, SortableTab, FileVisual } from "@/components/session"
import { useCommand } from "@/context/command"
import { useFile, type SelectedLineRange } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSettings } from "@/context/settings"
import { createFileTabListSync } from "@/pages/session/file-tab-scroll"
import { FileTabContent } from "@/pages/session/file-tabs"
import {
  createOpenSessionFileTab,
  createSessionTabs,
  getTabReorderIndex,
  shouldShowFileTree,
  type Sizing,
} from "@/pages/session/helpers"
import { setSessionHandoff } from "@/pages/session/handoff"
import { useSessionLayout } from "@/pages/session/session-layout"

const FILE_TREE_MIN_WIDTH = 200
const FILE_TREE_MAX_WIDTH = 480

type RenderDiff = (SnapshotFileDiff & { file: string }) | VcsFileDiff

type SessionSidePanelProps = {
  canReview: () => boolean
  diffs: () => (SnapshotFileDiff | VcsFileDiff)[]
  diffsReady: () => boolean
  empty: () => string
  hasReview: () => boolean
  reviewCount: () => number
  reviewPanel: () => JSX.Element
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  reviewSnap: boolean
  size: Sizing
  embedded?: boolean
}

type SessionSidePanelState = ReturnType<typeof createSessionSidePanelState>

function renderDiff(value: SnapshotFileDiff | VcsFileDiff): value is RenderDiff {
  return typeof value.file === "string"
}

export function SessionSidePanel(props: SessionSidePanelProps) {
  return <SessionSidePanelShell state={createSessionSidePanelState(props)} />
}

function createSessionSidePanelState(props: SessionSidePanelProps) {
  const base = createSidePanelBase()
  const visibility = createSidePanelVisibility(props, base)
  const diffs = createSidePanelDiffs(props)
  const tabs = createSidePanelTabs(props, base, visibility)
  const fileTree = createSidePanelFileTree(base, diffs, tabs)
  const workflow = createWorkflowPanelState(props, base, tabs)
  const drag = createSidePanelDrag(base, tabs)

  createSessionHandoffEffect(base)

  return { props, ...base, visibility, diffs, tabs, fileTree, workflow, drag }
}

function createSidePanelBase() {
  const layout = useLayout()
  const settings = useSettings()
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const dialog = useDialog()
  const session = useSessionLayout()
  const isDesktop = createMediaQuery("(min-width: 768px)")

  return { layout, settings, file, language, command, dialog, session, isDesktop }
}

function createSidePanelVisibility(props: SessionSidePanelProps, base: ReturnType<typeof createSidePanelBase>) {
  const shown = base.settings.visibility.fileTree
  const reviewOpen = createMemo(() => base.isDesktop() && base.session.view().reviewPanel.opened())
  const workflowLayout = createMemo(() => base.settings.general.newLayoutDesigns())
  const fileOpen = createMemo(() => base.isDesktop() && shouldShowFileTree({ visible: shown(), opened: base.layout.fileTree.opened() }))
  const open = createMemo(() => reviewOpen() || fileOpen())
  const reviewTab = createMemo(() => base.isDesktop())
  const panelWidth = createMemo(() => {
    if (!open()) return "0px"
    if (props.embedded) return "100%"
    if (reviewOpen()) return "auto"
    return `${base.layout.fileTree.width()}px`
  })
  const treeWidth = createMemo(() => {
    if (!fileOpen()) return "0px"
    if (props.embedded && !reviewOpen()) return "100%"
    return `${base.layout.fileTree.width()}px`
  })

  return { shown, reviewOpen, workflowLayout, fileOpen, open, reviewTab, panelWidth, treeWidth }
}

function createSidePanelDiffs(props: SessionSidePanelProps) {
  const diffs = createMemo(() => props.diffs().filter(renderDiff))
  const diffFiles = createMemo(() => diffs().map((diff) => diff.file))
  const kinds = createMemo(() => {
    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs()) {
      const file = diff.file.replaceAll("\\\\", "/").replace(/\/+$/, "")
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

      out.set(file, kind)
      for (const [idx] of file.split("/").slice(0, -1).entries()) {
        const dir = file.split("/").slice(0, idx + 1).join("/")
        if (dir) out.set(dir, mergeDiffKind(out.get(dir), kind))
      }
    }
    return out
  })

  return { diffs, diffFiles, kinds }
}

function mergeDiffKind(current: "add" | "del" | "mix" | undefined, next: "add" | "del" | "mix") {
  if (!current) return next
  if (current === next) return current
  return "mix" as const
}

function createSidePanelTabs(
  props: SessionSidePanelProps,
  base: ReturnType<typeof createSidePanelBase>,
  visibility: ReturnType<typeof createSidePanelVisibility>,
) {
  const normalizeTab = (tab: string) => (tab.startsWith("file://") ? base.file.tab(tab) : tab)
  const openReviewPanel = () => {
    if (!base.session.view().reviewPanel.opened()) base.session.view().reviewPanel.open()
  }
  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: base.session.tabs().open,
    pathFromTab: base.file.pathFromTab,
    loadFile: base.file.load,
    openReviewPanel,
    setActive: base.session.tabs().setActive,
  })
  const tabState = createSessionTabs({
    tabs: base.session.tabs,
    pathFromTab: base.file.pathFromTab,
    normalizeTab,
    review: visibility.reviewTab,
    hasReview: props.canReview,
  })

  return { openTab, ...tabState }
}

function createSidePanelFileTree(
  base: ReturnType<typeof createSidePanelBase>,
  diffs: ReturnType<typeof createSidePanelDiffs>,
  tabs: ReturnType<typeof createSidePanelTabs>,
) {
  const tab = () => base.layout.fileTree.tab()
  const tabsVariant = () => (base.settings.general.newLayoutDesigns() ? undefined : ("pill" as const))
  const nofiles = createMemo(() => fileTreeLoadedEmpty(base.file))
  const selectTab = (value: string) => {
    if (value !== "changes" && value !== "all") return
    base.layout.fileTree.setTab(value)
  }
  const showAllFiles = () => {
    if (tab() !== "changes") return
    base.layout.fileTree.setTab("all")
  }
  const openFileDialog = () => {
    void import("@/components/dialog-select-file").then((x) => {
      base.dialog.show(() => <x.DialogSelectFile mode="files" onOpenFile={showAllFiles} />)
    })
  }

  return { tab, tabsVariant, nofiles, selectTab, showAllFiles, openFileDialog, diffs, tabs }
}

function fileTreeLoadedEmpty(file: ReturnType<typeof useFile>) {
  const state = file.tree.state("")
  if (!state?.loaded) return false
  return file.tree.children("").length === 0
}

function createWorkflowPanelState(
  props: SessionSidePanelProps,
  base: ReturnType<typeof createSidePanelBase>,
  tabs: ReturnType<typeof createSidePanelTabs>,
) {
  const activeFilePath = createMemo(() => {
    const tab = tabs.activeFileTab()
    if (!tab) return
    return base.file.pathFromTab(tab)
  })
  const title = createMemo<JSX.Element>(() => {
    const path = activeFilePath()
    if (path) return <FileVisual active path={path} />
    if (tabs.activeTab() === "context") return <WorkflowContextTitle state={{ base }} />
    if (tabs.activeTab() === "empty") return base.language.t("session.files.selectToOpen")
    return <WorkflowReviewTitle state={{ base, props }} />
  })

  return { title }
}

function createSidePanelDrag(
  base: ReturnType<typeof createSidePanelBase>,
  tabs: ReturnType<typeof createSidePanelTabs>,
) {
  const [store, setStore] = createStore({ activeDraggable: undefined as string | undefined })
  const start = (event: unknown) => {
    const id = getDraggableId(event)
    if (id) setStore("activeDraggable", id)
  }
  const over = (event: DragEvent) => {
    if (!event.draggable || !event.droppable) return
    const toIndex = getTabReorderIndex(base.session.tabs().all(), event.draggable.id.toString(), event.droppable.id.toString())
    if (toIndex === undefined) return
    base.session.tabs().move(event.draggable.id.toString(), toIndex)
  }
  const end = () => setStore("activeDraggable", undefined)

  return { store, start, over, end, tabs }
}

function createSessionHandoffEffect(base: ReturnType<typeof createSidePanelBase>) {
  createEffect(() => {
    if (!base.file.ready()) return
    setSessionHandoff(base.session.sessionKey(), {
      files: Object.fromEntries(base.session.tabs().all().map((tab) => selectedRangeEntry(base.file, tab)).filter(isDefined)),
    })
  })
}

function selectedRangeEntry(file: ReturnType<typeof useFile>, tab: string): [string, SelectedLineRange | null] | undefined {
  const path = file.pathFromTab(tab)
  if (!path) return
  const selected = file.selectedLines(path)
  return [path, isSelectedLineRange(selected) ? selected : null]
}

function isSelectedLineRange(value: unknown): value is SelectedLineRange {
  return typeof value === "object" && value !== null && "start" in value && "end" in value
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function SessionSidePanelShell(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.isDesktop() && !(state.visibility.workflowLayout() && !state.session.params.id)}>
      <aside
        id="review-panel"
        aria-label={state.language.t("session.panel.reviewAndFiles")}
        aria-hidden={!state.visibility.open()}
        inert={!state.visibility.open()}
        class="relative min-w-0 h-full flex shrink-0 overflow-hidden"
        classList={sidePanelClassList(state)}
        style={{ width: state.visibility.panelWidth() }}
      >
        <Show when={state.visibility.open()}>
          <div class="size-full flex" classList={{ "border-l border-border-weaker-base": !state.visibility.workflowLayout() }}>
            <SessionReviewTabsPanel state={state} />
            <SessionFileTreePanel state={state} />
          </div>
        </Show>
      </aside>
    </Show>
  )
}

function sidePanelClassList(state: SessionSidePanelState) {
  return {
    "bg-[var(--workflow-panel-base)] text-v2-text-text-base": state.props.embedded,
    "bg-background-base": !state.props.embedded,
    "pointer-events-none": !state.visibility.open(),
    "transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
      !state.props.size.active() && !state.props.reviewSnap,
    "rounded-[10px] shadow-[var(--workflow-elevation-middle)] overflow-hidden": state.visibility.workflowLayout() && !state.props.embedded,
    "flex-1": state.visibility.reviewOpen(),
  }
}

function SessionReviewTabsPanel(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <div
      aria-hidden={!state.visibility.reviewOpen()}
      inert={!state.visibility.reviewOpen()}
      class="relative min-w-0 h-full flex-1 overflow-hidden"
      classList={reviewTabsPanelClassList(state)}
    >
      <div class="size-full min-w-0 h-full" classList={contentPanelClassList(state)}>
        <DragDropProvider onDragStart={state.drag.start} onDragEnd={state.drag.end} onDragOver={state.drag.over} collisionDetector={closestCenter}>
          <DragDropSensors />
          <ConstrainDragYAxis />
          <Tabs value={state.tabs.activeTab()} onChange={state.tabs.openTab}>
            <SessionTabHeader state={state} />
            <ReviewTabContent state={state} />
            <EmptyTabContent state={state} />
            <ContextTabContent state={state} />
            <Show when={state.tabs.activeFileTab()} keyed>{(tab) => <FileTabContent tab={tab} />}</Show>
          </Tabs>
          <FileTabDragOverlay state={state} />
        </DragDropProvider>
      </div>
    </div>
  )
}

function reviewTabsPanelClassList(state: SessionSidePanelState) {
  return {
    "bg-[var(--workflow-panel-content)]": state.props.embedded,
    "bg-background-base": !state.props.embedded,
    "pointer-events-none": !state.visibility.reviewOpen(),
    "hidden": state.props.embedded && !state.visibility.reviewOpen(),
  }
}

function contentPanelClassList(state: SessionSidePanelState) {
  return {
    "bg-[var(--workflow-panel-content)]": state.props.embedded,
    "bg-background-base": !state.props.embedded,
  }
}

function SessionTabHeader(props: { state: SessionSidePanelState }) {
  return (
    <Show when={props.state.visibility.workflowLayout()} fallback={<LegacySessionTabHeader state={props.state} />}>
      <SessionWorkflowPanelHeader
        title={props.state.workflow.title()}
        onOpenFile={props.state.fileTree.openFileDialog}
        openFileLabel={props.state.language.t("command.file.open")}
        openFileKeybind={props.state.command.keybind("file.open")}
      />
    </Show>
  )
}

function LegacySessionTabHeader(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <div class="sticky top-0 shrink-0 flex">
      <Tabs.List ref={(el: HTMLDivElement) => onCleanup(createFileTabListSync({ el, contextOpen: state.tabs.contextOpen }))}>
        <LegacyReviewTrigger state={state} />
        <LegacyContextTrigger state={state} />
        <SortableOpenedTabs state={state} />
        <div class="bg-background-stronger h-full shrink-0 sticky right-0 z-10 flex items-center justify-center pr-3">
          <OpenFileButton
            label={state.language.t("command.file.open")}
            keybind={state.command.keybind("file.open")}
            onOpen={state.fileTree.openFileDialog}
          />
        </div>
      </Tabs.List>
    </div>
  )
}

function LegacyReviewTrigger(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.visibility.reviewTab() && state.props.canReview()}>
      <Tabs.Trigger value="review">
        <div class="flex items-center gap-1.5">
          <div>{state.language.t("session.tab.review")}</div>
          <Show when={state.props.hasReview()}><div>{state.props.reviewCount()}</div></Show>
        </div>
      </Tabs.Trigger>
    </Show>
  )
}

function LegacyContextTrigger(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.tabs.contextOpen()}>
      <Tabs.Trigger closeButton={<CloseContextTabButton state={state} />} hideCloseButton onMiddleClick={() => state.session.tabs().close("context")} value="context">
        <div class="flex items-center gap-2">
          <SessionContextUsage variant="indicator" />
          <div>{state.language.t("session.tab.context")}</div>
        </div>
      </Tabs.Trigger>
    </Show>
  )
}

function CloseContextTabButton(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <TooltipKeybind title={state.language.t("common.closeTab")} keybind={state.command.keybind("tab.close")} placement="bottom" gutter={10}>
      <IconButton icon="close-small" variant="ghost" class="h-5 w-5" onClick={() => state.session.tabs().close("context")} aria-label={state.language.t("common.closeTab")} />
    </TooltipKeybind>
  )
}

function SortableOpenedTabs(props: { state: SessionSidePanelState }) {
  return (
    <SortableProvider ids={props.state.tabs.openedTabs()}>
      <For each={props.state.tabs.openedTabs()}>{(tab) => <SortableTab tab={tab} onTabClose={props.state.session.tabs().close} />}</For>
    </SortableProvider>
  )
}

function OpenFileButton(props: { label: string; keybind: string; onOpen: () => void }) {
  return (
    <TooltipKeybind title={props.label} keybind={props.keybind} class="flex items-center">
      <IconButton icon="plus-small" variant="ghost" iconSize="large" class="!rounded-md" onClick={props.onOpen} aria-label={props.label} />
    </TooltipKeybind>
  )
}

function SessionWorkflowPanelHeader(props: { title: JSX.Element; openFileLabel: string; openFileKeybind: string; onOpenFile: () => void }) {
  return (
    <WorkflowPanelHeader
      class="bg-[var(--workflow-panel-base)]"
      title={props.title}
      actions={<OpenFileButton label={props.openFileLabel} keybind={props.openFileKeybind} onOpen={props.onOpenFile} />}
    />
  )
}

function ReviewTabContent(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.visibility.reviewTab() && state.props.canReview()}>
      <Tabs.Content value="review" class={tabContentClass(state)}>
        <Show when={state.visibility.reviewOpen() && state.tabs.activeTab() === "review"}>{state.props.reviewPanel()}</Show>
      </Tabs.Content>
    </Show>
  )
}

function EmptyTabContent(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Tabs.Content value="empty" class={tabContentClass(state)}>
      <Show when={state.tabs.activeTab() === "empty"}>
        <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
          <div class="h-full px-6 pb-42 -mt-4 flex flex-col items-center justify-center text-center gap-6">
            <Mark class="w-14 opacity-10" />
            <div class="text-14-regular text-text-weak max-w-56">{state.language.t("session.files.selectToOpen")}</div>
          </div>
        </div>
      </Show>
    </Tabs.Content>
  )
}

function ContextTabContent(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.tabs.contextOpen()}>
      <Tabs.Content value="context" class={tabContentClass(state)}>
        <Show when={state.tabs.activeTab() === "context"}>
          <div class="relative pt-2 flex-1 min-h-0 overflow-hidden"><SessionContextTab /></div>
        </Show>
      </Tabs.Content>
    </Show>
  )
}

function tabContentClass(state: SessionSidePanelState) {
  if (state.visibility.workflowLayout()) return "flex flex-col h-full overflow-hidden contain-strict bg-[var(--workflow-panel-content)]"
  return "flex flex-col h-full overflow-hidden contain-strict"
}

function FileTabDragOverlay(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <DragOverlay>
      <Show when={state.drag.store.activeDraggable} keyed>
        {(tab) => (
          <div data-component="tabs-drag-preview">
            <Show when={state.file.pathFromTab(tab)}>{(path) => <FileVisual active path={path()} />}</Show>
          </div>
        )}
      </Show>
    </DragOverlay>
  )
}

function SessionFileTreePanel(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.visibility.shown()}>
      <div
        id="file-tree-panel"
        aria-hidden={!state.visibility.fileOpen()}
        inert={!state.visibility.fileOpen()}
        class="relative min-w-0 h-full shrink-0 overflow-hidden"
        classList={fileTreePanelClassList(state)}
        style={{ width: state.visibility.treeWidth() }}
      >
        <SessionFileTreeBody state={state} />
        <SessionFileTreeResizeHandle state={state} />
      </div>
    </Show>
  )
}

function fileTreePanelClassList(state: SessionSidePanelState) {
  return {
    "pointer-events-none": !state.visibility.fileOpen(),
    "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none": !state.props.size.active(),
  }
}

function SessionFileTreeBody(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <div class="h-full flex flex-col overflow-hidden group/filetree" classList={fileTreeBodyClassList(state)}>
      <Tabs variant={state.fileTree.tabsVariant()} value={state.fileTree.tab()} onChange={state.fileTree.selectTab} class="h-full" data-scope="filetree">
        <SessionFileTreeHeader state={state} />
        <ChangesFileTreeContent state={state} />
        <AllFilesContent state={state} />
      </Tabs>
    </div>
  )
}

function fileTreeBodyClassList(state: SessionSidePanelState) {
  return {
    "border-l border-border-weaker-base": state.visibility.reviewOpen() && !state.visibility.workflowLayout(),
    "bg-[var(--workflow-panel-base)]": state.visibility.workflowLayout(),
  }
}

function SessionFileTreeHeader(props: { state: SessionSidePanelState }) {
  return (
    <Show when={props.state.visibility.workflowLayout()} fallback={<LegacyFileTreeHeader state={props.state} />}>
      <SessionWorkflowFileTreeHeader state={props.state} />
    </Show>
  )
}

function LegacyFileTreeHeader(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Tabs.List>
      <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
        {state.props.reviewCount()} {state.language.t(state.props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other")}
      </Tabs.Trigger>
      <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
        {state.language.t("session.files.all")}
      </Tabs.Trigger>
    </Tabs.List>
  )
}

function SessionWorkflowFileTreeHeader(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <WorkflowPanelHeader
      class="bg-[var(--workflow-panel-base)]"
      title={
        <WorkflowSegmentedControl
          value={state.fileTree.tab()}
          options={[
            { value: "changes", label: `${state.props.reviewCount()} ${state.language.t(state.props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other")}` },
            { value: "all", label: state.language.t("session.files.all") },
          ]}
          onSelect={state.fileTree.selectTab}
        />
      }
    />
  )
}

function ChangesFileTreeContent(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Tabs.Content value="changes" class={fileTreeContentClass(state)}>
      <Switch>
        <Match when={state.props.hasReview() || !state.props.diffsReady()}>
          <Show when={state.props.diffsReady()} fallback={<FileTreeLoading state={state} />}>
            <FileTree path="" class="pt-3" allowed={state.diffs.diffFiles()} kinds={state.diffs.kinds()} draggable={false} active={state.props.activeDiff} onFileClick={(node) => state.props.focusReviewDiff(node.path)} />
          </Show>
        </Match>
      </Switch>
    </Tabs.Content>
  )
}

function AllFilesContent(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Tabs.Content value="all" class={fileTreeContentClass(state)}>
      <Switch>
        <Match when={state.fileTree.nofiles()}>{emptyFileTreeMessage(state.language.t("session.files.empty"))}</Match>
        <Match when={true}>
          <FileTree path="" class="pt-3" modified={state.diffs.diffFiles()} kinds={state.diffs.kinds()} onFileClick={(node) => state.tabs.openTab(state.file.tab(node.path))} />
        </Match>
      </Switch>
    </Tabs.Content>
  )
}

function fileTreeContentClass(state: SessionSidePanelState) {
  if (state.visibility.workflowLayout()) return "bg-[var(--workflow-panel-content)] px-3 py-0"
  return "bg-background-stronger px-3 py-0"
}

function FileTreeLoading(props: { state: SessionSidePanelState }) {
  return (
    <div class="px-2 py-2 text-12-regular text-text-weak">
      {props.state.language.t("common.loading")}
      {props.state.language.t("common.loading.ellipsis")}
    </div>
  )
}

function emptyFileTreeMessage(message: string) {
  return (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{message}</div>
      </div>
    </div>
  )
}

function SessionFileTreeResizeHandle(props: { state: SessionSidePanelState }) {
  const state = props.state
  return (
    <Show when={state.visibility.fileOpen()}>
      <div onPointerDown={() => state.props.size.start()}>
        <ResizeHandle
          direction="horizontal"
          edge="start"
          size={state.layout.fileTree.width()}
          min={FILE_TREE_MIN_WIDTH}
          max={FILE_TREE_MAX_WIDTH}
          onResize={(width) => {
            state.props.size.touch()
            state.layout.fileTree.resize(width)
          }}
        />
      </div>
    </Show>
  )
}

function WorkflowContextTitle(props: { state: { base: ReturnType<typeof createSidePanelBase> } }) {
  return (
    <div class="flex min-w-0 items-center gap-2">
      <SessionContextUsage variant="indicator" />
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {props.state.base.language.t("session.tab.context")}
      </span>
    </div>
  )
}

function WorkflowReviewTitle(props: { state: { base: ReturnType<typeof createSidePanelBase>; props: SessionSidePanelProps } }) {
  return (
    <div class="flex min-w-0 items-center gap-2">
      <span>{props.state.base.language.t("session.tab.review")}</span>
      <Show when={props.state.props.hasReview()}>
        <span class={WORKFLOW_BADGE}>{props.state.props.reviewCount()}</span>
      </Show>
    </div>
  )
}
