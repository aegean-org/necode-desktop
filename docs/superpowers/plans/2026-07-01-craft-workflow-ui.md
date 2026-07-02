# Craft Workflow UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 of the Craft-style workflow UI: Home and Session detail share a coherent workflow shell, entity-list language, right-panel treatment, and docked composer without adding Craft-only product concepts.

**Architecture:** Keep `settings.general.newLayoutDesigns()` as the gate. Build shared workflow primitives first, then migrate Home and Session surfaces to those primitives. Preserve OpenCode session execution and data flow; only change shell, navigation, visual structure, and interaction surfaces.

**Tech Stack:** SolidJS, TypeScript, Bun, Tailwind utility classes, existing OpenCode UI package, existing app state/settings/session stores.

## Global Constraints

- Work from `D:\project\opencode`.
- Run `bun typecheck` and app tests from `D:\project\opencode\packages\app`, never from the repository root.
- Preserve unrelated dirty files; stage only files touched by the current task.
- Keep `settings.general.newLayoutDesigns()` as the workflow layout gate.
- Do not add Craft `Sources` or `Automations` backend concepts in Phase 1.
- Do not rewrite session execution, model routing, provider selection, or tool execution.
- Do not add mock success paths, silent fallbacks, or hidden degradation.
- Do not use `git reset --hard` or broad checkout commands.
- Use OpenCode-native names: workspace, project, session, task, agent, command, plugin, context.

---

## Scope

This plan implements Phase 1: Workflow Closure.

Included:

- Shared shell contract and surface tokens.
- Shared workflow entity row/list/header/dock primitives.
- Home workflow inbox alignment.
- Session workflow navigator and detail shell alignment.
- Right panel, file/context/review treatment, and composer dock boundary.
- DOM/smoke tests for workflow shell presence and surface contract.

Excluded:

- Full animated compact navigator/detail transitions.
- Multi-panel content stack.
- Craft-style Sources/Automations models.
- Agents/commands/plugins navigation implementation beyond preserving compatible component boundaries.

## File Structure

Create:

- `packages/app/src/components/workflow-ui.test.ts`
  - Tests pure workflow UI class/build helpers that back shared row/header components.
- `packages/app/src/pages/session/workflow-chat-input-dock.tsx`
  - Small wrapper that makes the existing composer visually belong to the content panel.
- `packages/app/e2e/smoke/workflow-shell.spec.ts`
  - Smoke test for workflow shell DOM contract on Home and Session detail.

Modify:

- `packages/app/src/components/workflow-shell-state.ts`
  - Own Craft-derived constants, scoped CSS variables, panel surface classes, compact boundary helpers.
- `packages/app/src/components/workflow-shell-state.test.ts`
  - Lock shell geometry, scope, resize constraints, and panel surfaces.
- `packages/app/src/components/workflow-shell.tsx`
  - Ensure shell emits stable data attributes and routes compact/desktop role data consistently.
- `packages/app/src/components/workflow-ui.tsx`
  - Add shared `WorkflowEntityRow`, strengthen `WorkflowEntityList`, extend `WorkflowPanelHeader`, keep `WorkflowSegmentedControl`.
- `packages/app/src/pages/home.tsx`
  - Replace page-local task row/header/list styling with shared workflow primitives.
- `packages/app/src/pages/home/workflow-sidebar.tsx`
  - Keep OpenCode-native navigation while using workflow sidebar row/header primitives.
- `packages/app/src/pages/home/workflow-overview.tsx`
  - Use shared surface/card tokens.
- `packages/app/src/pages/home/workflow-inspector.tsx`
  - Keep inspector as right-panel content, not a separate header/card system.
- `packages/app/src/pages/session.tsx`
  - Wire Session detail into shared shell, dock wrapper, navigator and right panel behavior.
- `packages/app/src/pages/session/workflow-session-sidebar.tsx`
  - Align project/workspace sidebar with workflow sidebar behavior.
- `packages/app/src/pages/session/workflow-session-navigator.tsx`
  - Use shared workflow entity row/list/header primitives.
- `packages/app/src/pages/session/session-side-panel.tsx`
  - Align file/context/review panel header and content surfaces.
- `packages/app/src/pages/session/composer/session-composer-region.tsx`
  - Keep internal composer behavior; remove workflow-only chrome that belongs in `WorkflowChatInputDock`.
- `packages/app/src/pages/session/timeline/message-timeline.tsx`
  - Align timeline background/title treatment with content panel without adding a second shell.
- `packages/app/src/pages/session/helpers.test.ts`
  - Extend existing helper coverage for workflow mode behavior.
- `packages/app/src/components/titlebar.tsx`
  - Keep workflow titlebar behavior consistent with shell chrome.
- `packages/app/src/components/titlebar-workflow.ts`
  - Keep titlebar workflow branching small and testable.
- `packages/app/src/components/titlebar-workflow.test.ts`
  - Add/adjust tests when titlebar workflow behavior changes.

---

### Task 1: Lock Workflow Shell Contract

**Files:**
- Modify: `packages/app/src/components/workflow-shell-state.ts`
- Modify: `packages/app/src/components/workflow-shell-state.test.ts`
- Modify: `packages/app/src/components/workflow-shell.tsx`

**Interfaces:**
- Consumes: current `WorkflowShell` props: `{ left?, navigator?, center, right?, leftWidth?, navigatorWidth?, rightWidth?, storageKey? }`.
- Produces:
  - `WORKFLOW_SHELL_LIMITS`
  - `workflowShellSurfaceStyle(): Record<string, string | number>`
  - `workflowPanelSurfaceClass(role: WorkflowShellPanelRole): string`
  - `workflowPanelChromeStyle(input: { atLeftEdge: boolean; atRightEdge: boolean }): Record<string, string | number>`
  - stable DOM roles: `sidebar`, `navigator`, `content`, `right-sidebar`

- [ ] **Step 1: Add failing tests for shell contract**

Add these assertions to `packages/app/src/components/workflow-shell-state.test.ts`:

```ts
test("keeps Phase 1 workflow shell constants aligned with Craft", () => {
  expect(WORKFLOW_SHELL_LIMITS.gap).toBe(6)
  expect(WORKFLOW_SHELL_LIMITS.edgeInset).toBe(6)
  expect(WORKFLOW_SHELL_LIMITS.innerRadius).toBe(10)
  expect(WORKFLOW_SHELL_LIMITS.edgeRadius).toBe(8)
  expect(WORKFLOW_SHELL_LIMITS.centerMin).toBe(440)
  expect(WORKFLOW_SHELL_LIMITS.stackVerticalOverflow).toBe(8)
})

test("keeps workflow surface variables scoped to the shell contract", () => {
  const style = workflowShellSurfaceStyle()

  expect(style["--workflow-shell-background"]).toContain("color-mix")
  expect(style["--workflow-panel-base"]).toContain("color-mix")
  expect(style["--workflow-panel-content"]).toContain("color-mix")
  expect(style["--background-base"]).toBe("var(--workflow-panel-base)")
  expect(style["--background-stronger"]).toBe("var(--workflow-panel-content)")
  expect(style.background).toBe("var(--workflow-shell-background)")
})

test("keeps panel surface roles distinct", () => {
  expect(workflowPanelSurfaceClass("left")).toBe("bg-transparent")
  expect(workflowPanelSurfaceClass("navigator")).toContain("--workflow-panel-base")
  expect(workflowPanelSurfaceClass("content")).toContain("--workflow-panel-content")
  expect(workflowPanelSurfaceClass("right")).toContain("--workflow-panel-base")
})
```

- [ ] **Step 2: Run tests to verify current contract**

Run:

```powershell
cd D:\project\opencode\packages\app
bun test src/components/workflow-shell-state.test.ts
```

Expected: either PASS if current code already satisfies the contract, or FAIL with a concrete mismatch in shell constants/surface classes.

- [ ] **Step 3: Adjust shell state implementation**

If tests fail, update `packages/app/src/components/workflow-shell-state.ts` so the relevant objects match this shape:

```ts
export const WORKFLOW_SHELL_LIMITS = {
  leftDefault: 280,
  navigatorDefault: 360,
  rightDefault: 360,
  leftMin: 220,
  leftMax: 420,
  navigatorMin: 300,
  navigatorMax: 560,
  rightMin: 300,
  rightMax: 560,
  centerMin: 440,
  gap: 6,
  edgeInset: 6,
  edgeRadius: 8,
  innerRadius: 10,
  stackVerticalOverflow: 8,
  stackRightOverflow: 8,
} as const

const WORKFLOW_PANEL_SURFACE_CLASS: Record<WorkflowShellPanelRole, string> = {
  left: "bg-transparent",
  navigator: "bg-[var(--workflow-panel-base)] shadow-[var(--workflow-elevation-middle)]",
  content: "bg-[var(--workflow-panel-content)] shadow-[var(--workflow-elevation-middle)]",
  right: "bg-[var(--workflow-panel-base)] shadow-[var(--workflow-elevation-middle)]",
}
```

- [ ] **Step 4: Ensure shell DOM roles stay stable**

In `packages/app/src/components/workflow-shell.tsx`, verify these attributes remain present:

The shell render must contain these exact attributes on the existing elements:

```tsx
data-component="workflow-shell"
data-component="workflow-panel-scroll"
data-component="workflow-panel-stack"
data-panel-role="content"
data-panel-role={workflowPanelRole(props.side)}
```

The role helper must stay:

```ts
function workflowPanelRole(side: WorkflowShellPanelSide) {
  if (side === "left") return "sidebar"
  if (side === "navigator") return "navigator"
  return "right-sidebar"
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
cd D:\project\opencode\packages\app
bun test src/components/workflow-shell-state.test.ts
bun typecheck
```

Expected: tests pass and `tsgo -b` exits successfully.

- [ ] **Step 6: Commit**

```powershell
cd D:\project\opencode
git add packages/app/src/components/workflow-shell-state.ts packages/app/src/components/workflow-shell-state.test.ts packages/app/src/components/workflow-shell.tsx
git commit -m "test(app): lock workflow shell contract"
```

---

### Task 2: Add Shared Workflow Entity Row and Header Utilities

**Files:**
- Modify: `packages/app/src/components/workflow-ui.tsx`
- Create: `packages/app/src/components/workflow-ui.test.ts`

**Interfaces:**
- Consumes: `WORKFLOW_BADGE`, `WORKFLOW_ENTITY_ROW`, `WORKFLOW_NAV_ROW`, `WORKFLOW_SURFACE_CARD`.
- Produces:
  - `workflowEntityRowDataAttributes(input: { selected?: boolean; rowID?: string }): Record<string, string | undefined>`
  - `WorkflowEntityRow(props)`
  - extended `WorkflowPanelHeader` with optional `leadingAction`

- [ ] **Step 1: Write failing tests for pure UI helpers**

Create `packages/app/src/components/workflow-ui.test.ts`:

```ts
import { describe, expect, test } from "bun:test"
import { WORKFLOW_ENTITY_ROW, WORKFLOW_NAV_ROW, workflowEntityRowDataAttributes } from "./workflow-ui"

describe("workflow UI primitives", () => {
  test("keeps entity rows using the workflow selected treatment", () => {
    expect(WORKFLOW_ENTITY_ROW).toContain("data-[selected]")
    expect(WORKFLOW_ENTITY_ROW).toContain("--workflow-row-hover")
    expect(WORKFLOW_ENTITY_ROW).toContain("--v2-icon-icon-accent")
  })

  test("keeps navigation rows compact and selectable", () => {
    expect(WORKFLOW_NAV_ROW).toContain("h-7")
    expect(WORKFLOW_NAV_ROW).toContain("data-[selected]")
  })

  test("builds stable row data attributes", () => {
    expect(workflowEntityRowDataAttributes({ selected: true, rowID: "ses_123" })).toEqual({
      "data-selected": "",
      "data-row-id": "ses_123",
    })
    expect(workflowEntityRowDataAttributes({ selected: false })).toEqual({
      "data-selected": undefined,
      "data-row-id": undefined,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd D:\project\opencode\packages\app
bun test src/components/workflow-ui.test.ts
```

Expected: FAIL because `workflowEntityRowDataAttributes` is not exported.

- [ ] **Step 3: Implement helper and shared row component**

Add to `packages/app/src/components/workflow-ui.tsx`:

```tsx
export function workflowEntityRowDataAttributes(input: { selected?: boolean; rowID?: string }) {
  return {
    "data-selected": input.selected ? "" : undefined,
    "data-row-id": input.rowID,
  }
}

export function WorkflowEntityRow(props: {
  title: JSX.Element
  subtitle?: JSX.Element
  icon?: JSX.Element
  badge?: JSX.Element
  trailing?: JSX.Element
  actions?: JSX.Element
  selected?: boolean
  rowID?: string
  class?: string
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      {...workflowEntityRowDataAttributes({ selected: props.selected, rowID: props.rowID })}
      class={`group flex min-h-[58px] w-full min-w-0 flex-col gap-1 px-3 py-2 ${WORKFLOW_ENTITY_ROW} ${props.class ?? ""}`}
      onClick={props.onSelect}
    >
      <div class="flex min-w-0 items-start gap-2">
        {props.icon ? <div class="mt-0.5 flex size-4 shrink-0 items-center justify-center">{props.icon}</div> : null}
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="flex min-w-0 items-center gap-2">
            <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-5 text-v2-text-text-base [font-weight:530]">
              {props.title}
            </span>
            {props.badge ? <span class={WORKFLOW_BADGE}>{props.badge}</span> : null}
            {props.trailing ? <span class="shrink-0 text-[11px] leading-4 text-v2-text-text-muted">{props.trailing}</span> : null}
          </div>
          {props.subtitle ? (
            <div class="line-clamp-2 min-w-0 text-[12px] leading-4 text-v2-text-text-muted [font-weight:420]">
              {props.subtitle}
            </div>
          ) : null}
        </div>
        {props.actions ? <div class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">{props.actions}</div> : null}
      </div>
    </button>
  )
}
```

Extend `WorkflowPanelHeader` props and render path:

```tsx
export function WorkflowPanelHeader(props: {
  title: JSX.Element
  badge?: JSX.Element
  leadingAction?: JSX.Element
  actions?: JSX.Element
  class?: string
}) {
  const hasBadge = () => props.badge !== undefined
  return (
    <div
      data-component="workflow-panel-header"
      class={`flex h-[42px] shrink-0 items-center justify-between gap-3 pl-4 pr-2 ${props.class ?? ""}`}
    >
      <div class="flex min-w-0 items-center gap-2">
        {props.leadingAction ? <div class="shrink-0">{props.leadingAction}</div> : null}
        <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-5 text-v2-text-text-base [font-weight:560]">
          {props.title}
        </div>
        {hasBadge() ? <span class={WORKFLOW_BADGE}>{props.badge}</span> : null}
      </div>
      {props.actions ? <div class="flex shrink-0 items-center gap-1">{props.actions}</div> : null}
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```powershell
cd D:\project\opencode\packages\app
bun test src/components/workflow-ui.test.ts src/components/workflow-shell-state.test.ts
bun typecheck
```

Expected: tests pass and typecheck passes.

- [ ] **Step 5: Commit**

```powershell
cd D:\project\opencode
git add packages/app/src/components/workflow-ui.tsx packages/app/src/components/workflow-ui.test.ts
git commit -m "feat(app): add workflow entity row primitive"
```

---

### Task 3: Migrate Home Workflow Inbox to Shared Primitives

**Files:**
- Modify: `packages/app/src/pages/home.tsx`
- Modify: `packages/app/src/pages/home/workflow-sidebar.tsx`
- Modify: `packages/app/src/pages/home/workflow-overview.tsx`
- Modify: `packages/app/src/pages/home/workflow-inspector.tsx`
- Modify: `packages/app/src/pages/home/workflow-task.test.ts`

**Interfaces:**
- Consumes:
  - `WorkflowShell`
  - `WorkflowEntityList`
  - `WorkflowEntityRow`
  - `WorkflowSectionHeader`
  - `WorkflowPanelHeader`
- Produces: Home page workflow inbox where task rows and navigation rows come from shared primitives.

- [ ] **Step 1: Add projection test for Home row metadata**

Extend `packages/app/src/pages/home/workflow-task.test.ts` with:

```ts
test("keeps task row metadata stable for workflow entity rows", () => {
  const tasks = buildWorkflowTasks({
    sessions: [sessionFixture({ id: "ses_running", title: "Implement shell", time: 10, isProcessing: true })],
    directories: [],
  })

  expect(tasks[0].id).toBe("ses_running")
  expect(tasks[0].title).toBe("Implement shell")
  expect(tasks[0].status).toBe("running")
  expect(workflowTaskMeta(tasks[0]).map((item) => item.id)).toEqual(["status", "updated"])
})
```

If fixture names differ in the existing file, use the existing fixture helper and preserve the same assertion shape.

- [ ] **Step 2: Run test**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/home/workflow-task.test.ts
```

Expected: PASS if projection already supports metadata; FAIL with an exact helper/import issue if current fixtures need a small adjustment.

- [ ] **Step 3: Replace page-local task row markup**

In `packages/app/src/pages/home.tsx`, update imports:

```ts
import {
  WORKFLOW_BADGE,
  WORKFLOW_NAV_ROW,
  WorkflowEntityList,
  WorkflowEntityRow,
  WorkflowPanelHeader,
  WorkflowSectionHeader,
} from "@/components/workflow-ui"
```

Replace the body of `HomeWorkflowTaskRow` with:

```tsx
function HomeWorkflowTaskRow(props: {
  task: WorkflowTask
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const language = useLanguage()
  const meta = createMemo(() => workflowTaskMeta(props.task))

  return (
    <WorkflowEntityRow
      rowID={props.task.id}
      selected={props.selected}
      title={sessionTitle(props.task.title) || props.task.id}
      subtitle={props.task.summary}
      badge={language.t(workflowStatusTitleKey(props.task.status))}
      trailing={props.task.relativeUpdated}
      onSelect={props.onSelect}
      actions={
        <ButtonV2 variant="ghost-muted" size="normal" icon="edit" onClick={props.onOpen}>
          {language.t("home.tasks.detail.open")}
        </ButtonV2>
      }
      class="home-workflow-task-row"
    />
  )
}
```

If current task fields use different names, preserve the same UI contract and map existing values explicitly inside `HomeWorkflowTaskRow`.

- [ ] **Step 4: Ensure Home list uses shared list and section headers**

Use this shape around grouped tasks in `packages/app/src/pages/home.tsx`:

```tsx
<WorkflowEntityList class="px-2">
  <For each={taskGroups()}>
    {(group) => (
      <>
        <WorkflowSectionHeader title={language.t(group.titleKey)} count={group.tasks.length} />
        <For each={group.tasks}>
          {(task) => (
            <HomeWorkflowTaskRow
              task={task}
              selected={selectedTask()?.id === task.id}
              onSelect={() => setSelectedTaskID(task.id)}
              onOpen={() => openTask(task)}
            />
          )}
        </For>
      </>
    )}
  </For>
</WorkflowEntityList>
```

Use the existing state setter and opener names from the file; do not create duplicate state.

- [ ] **Step 5: Align Home sidebar and inspector**

In `workflow-sidebar.tsx`, ensure row classes use `WORKFLOW_NAV_ROW`.

In `workflow-inspector.tsx`, keep the inline inspector title area from the approved 16:58 boundary and ensure internal surfaces use `WORKFLOW_SURFACE_CARD`.

In `workflow-overview.tsx`, ensure overview action surfaces use `WORKFLOW_SURFACE_BUTTON`.

- [ ] **Step 6: Verify**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/home/workflow-task.test.ts src/components/workflow-ui.test.ts
bun typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
cd D:\project\opencode
git add packages/app/src/pages/home.tsx packages/app/src/pages/home/workflow-sidebar.tsx packages/app/src/pages/home/workflow-overview.tsx packages/app/src/pages/home/workflow-inspector.tsx packages/app/src/pages/home/workflow-task.test.ts
git commit -m "feat(app): align home workflow inbox"
```

---

### Task 4: Align Session Navigator and Workflow Sidebar

**Files:**
- Modify: `packages/app/src/pages/session.tsx`
- Modify: `packages/app/src/pages/session/workflow-session-sidebar.tsx`
- Modify: `packages/app/src/pages/session/workflow-session-navigator.tsx`
- Modify: `packages/app/src/pages/session/helpers.test.ts`

**Interfaces:**
- Consumes:
  - `WorkflowShell`
  - `WorkflowEntityList`
  - `WorkflowEntityRow`
  - `WorkflowPanelHeader`
  - `WorkflowSectionHeader`
- Produces:
  - Session detail shell with OpenCode-native left sidebar.
  - Session navigator rows that share Home row behavior.

- [ ] **Step 1: Add helper test for workflow session initialization**

Extend `packages/app/src/pages/session/helpers.test.ts`:

```ts
test("keeps workflow layout from centering desktop session content", () => {
  expect(
    shouldCenterSessionContent({
      isDesktop: true,
      hasReview: false,
      workflowLayout: true,
    }),
  ).toBe(false)
})
```

If `shouldCenterSessionContent` already has equivalent coverage, add a more specific assertion for the `workflowLayout: true` branch instead of duplicating the existing case.

- [ ] **Step 2: Run helper tests**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/session/helpers.test.ts
```

Expected: PASS or FAIL with exact signature mismatch. If signature differs, update the test to the current helper signature without changing behavior.

- [ ] **Step 3: Replace session navigator rows**

In `packages/app/src/pages/session/workflow-session-navigator.tsx`, import and use shared primitives:

```ts
import { WORKFLOW_BADGE, WorkflowEntityList, WorkflowEntityRow, WorkflowPanelHeader } from "@/components/workflow-ui"
```

Render each task/session row with this shape:

```tsx
<WorkflowEntityRow
  rowID={task().id}
  selected={props.activeID === task().id}
  title={sessionTitle(task().title) || task().id}
  subtitle={task().summary}
  badge={language.t(workflowStatusTitleKey(task().status))}
  trailing={task().relativeUpdated}
  onSelect={() => props.onOpenSession(task().session)}
  class="workflow-session-row"
/>
```

Map current task fields explicitly if names differ.

- [ ] **Step 4: Keep Session shell slot wiring explicit**

In `packages/app/src/pages/session.tsx`, preserve the workflow shell structure:

```tsx
const workflowSessionShell = () => (
  <WorkflowShell
    storageKey="session.workflow-shell.panels"
    left={
      <WorkflowSessionSidebar
        projects={layout.projects.list()}
        activeDirectory={sdk().directory}
        tasks={workflowSessionTasks()}
        filter={store.workflowFilter}
        onFilter={(filter) => setStore("workflowFilter", filter)}
        onOpenProject={openWorkflowProject}
        onNewSession={openWorkflowProjectNewSession}
        onOpenSettings={openWorkflowSettings}
        onOpenHelp={openWorkflowHelp}
      />
    }
    navigator={
      <WorkflowSessionNavigator
        embedded
        tasks={filteredWorkflowSessionTasks()}
        activeID={activeWorkflowSessionID()}
        loading={sessionWorkflowLoad.isLoading}
        onOpenSession={openWorkflowSession}
        onNewSession={openWorkflowNewSession}
      />
    }
    center={sessionPanel(true)}
    right={desktopSidePanelOpen() ? sidePanel(true) : undefined}
    leftWidth={280}
    navigatorWidth={360}
    rightWidth={desktopReviewOpen() ? 520 : layout.fileTree.width()}
  />
)
```

Ensure `right` is omitted when no right-panel content is available. Do not pass an empty auxiliary panel.

- [ ] **Step 5: Align workflow session sidebar**

In `workflow-session-sidebar.tsx`, use `WORKFLOW_NAV_ROW` for project/workspace rows and `WorkflowSectionHeader` for section labels. Keep labels OpenCode-native.

- [ ] **Step 6: Verify**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/session/helpers.test.ts src/pages/home/workflow-task.test.ts src/components/workflow-ui.test.ts
bun typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
cd D:\project\opencode
git add packages/app/src/pages/session.tsx packages/app/src/pages/session/workflow-session-sidebar.tsx packages/app/src/pages/session/workflow-session-navigator.tsx packages/app/src/pages/session/helpers.test.ts
git commit -m "feat(app): align session workflow navigator"
```

---

### Task 5: Dock Composer and Align Right Panel Surfaces

**Files:**
- Create: `packages/app/src/pages/session/workflow-chat-input-dock.tsx`
- Modify: `packages/app/src/pages/session.tsx`
- Modify: `packages/app/src/pages/session/composer/session-composer-region.tsx`
- Modify: `packages/app/src/pages/session/session-side-panel.tsx`
- Modify: `packages/app/src/pages/session/timeline/message-timeline.tsx`

**Interfaces:**
- Consumes: existing `SessionComposerRegion` and right-panel state.
- Produces:
  - `WorkflowChatInputDock(props: { children: JSX.Element; class?: string }): JSX.Element`
  - Session content panel where composer dock belongs to the panel.

- [ ] **Step 1: Add dock component**

Create `packages/app/src/pages/session/workflow-chat-input-dock.tsx`:

```tsx
import { type JSX } from "solid-js"

/** Dock that makes the existing composer belong to the workflow content panel. */
export function WorkflowChatInputDock(props: { children: JSX.Element; class?: string }) {
  return (
    <div
      data-component="workflow-chat-input-dock"
      class={`shrink-0 bg-[var(--workflow-panel-content)] px-4 pb-4 pt-2 ${props.class ?? ""}`}
    >
      {props.children}
    </div>
  )
}
```

- [ ] **Step 2: Use dock in Session content panel**

In `packages/app/src/pages/session.tsx`, import:

```ts
import { WorkflowChatInputDock } from "@/pages/session/workflow-chat-input-dock"
```

Wrap the workflow composer render path by changing `composerRegion` to accept workflow placement:

```tsx
const composerRegion = (placement: "dock" | "inline") => {
  const region = (
    <SessionComposerRegion
      state={composer}
      ready={!store.deferRender && messagesReady()}
      centered={placement === "dock" && centered()}
      placement={placement}
      inputRef={(el) => {
        inputRef = el
      }}
      newSessionWorktree={newSessionWorktree()}
      onNewSessionWorktreeReset={() => setStore("newSessionWorktree", "main")}
      onSubmit={() => {
        comments.clear()
        resumeScroll()
      }}
      onResponseSubmit={resumeScroll}
      followup={
        params.id && !isChildSession()
          ? {
              queue: queueEnabled,
              items: followupDock(),
              sending: sendingFollowup(),
              edit: editingFollowup(),
              onQueue: queueFollowup,
              onAbort: () => {
                const id = params.id
                if (!id) return
                setFollowup("paused", id, true)
              },
              onSend: (id) => {
                void sendFollowup(params.id!, id, { manual: true })
              },
              onEdit: editFollowup,
              onEditLoaded: clearFollowupEdit,
            }
          : undefined
      }
      revert={
        rolled().length > 0
          ? {
              items: rolled(),
              restoring: restoring(),
              disabled: reverting(),
              onRestore: restore,
            }
          : undefined
      }
      setPromptDockRef={(el) => {
        promptDock = el
      }}
    />
  )

  if (placement !== "dock" || !settings.general.newLayoutDesigns()) return region
  return <WorkflowChatInputDock>{region}</WorkflowChatInputDock>
}
```

Do not duplicate composer state. The wrapper only changes placement chrome.

- [ ] **Step 3: Remove workflow-only outer chrome from composer internals**

In `session-composer-region.tsx`, keep behavior and state unchanged. Move workflow-only padding/background classes to `WorkflowChatInputDock`.

The composer region should still receive the same props and preserve:

```tsx
<SessionComposerRegion
  state={composer}
  ready={!store.deferRender && messagesReady()}
  centered={placement === "dock" && centered()}
  placement={placement}
  inputRef={(el) => {
    inputRef = el
  }}
  newSessionWorktree={newSessionWorktree()}
  onNewSessionWorktreeReset={() => setStore("newSessionWorktree", "main")}
  onSubmit={() => {
    comments.clear()
    resumeScroll()
  }}
  onResponseSubmit={resumeScroll}
  followup={params.id && !isChildSession() ? followupConfig : undefined}
  revert={rolled().length > 0 ? revertConfig : undefined}
  setPromptDockRef={(el) => {
    promptDock = el
  }}
/>
```

`followupConfig` and `revertConfig` refer to the existing inline object values already present in `session.tsx`; do not move those behaviors into `WorkflowChatInputDock`.

- [ ] **Step 4: Align right panel headers and content**

In `session-side-panel.tsx`, keep workflow mode using:

```tsx
<WorkflowPanelHeader
  class="bg-[var(--workflow-panel-base)]"
  title={props.title}
  actions={props.actions}
/>
```

Ensure file/context/review bodies use panel content surfaces and do not create a nested raised shell. Internal small surfaces may use `WORKFLOW_SURFACE_CARD`.

- [ ] **Step 5: Align timeline background**

In `message-timeline.tsx`, avoid adding workflow-specific title/header logic. The message timeline should inherit content panel surface through CSS variables. Keep sticky title behavior stable and only change background tokens when required:

```tsx
"sticky top-0 z-30 bg-[linear-gradient(to_bottom,var(--background-stronger)_48px,transparent)]": true
```

Do not add `workflow?: boolean` to `MessageTimeline` in Phase 1.

- [ ] **Step 6: Verify**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/session/helpers.test.ts src/components/workflow-shell-state.test.ts
bun typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
cd D:\project\opencode
git add packages/app/src/pages/session/workflow-chat-input-dock.tsx packages/app/src/pages/session.tsx packages/app/src/pages/session/composer/session-composer-region.tsx packages/app/src/pages/session/session-side-panel.tsx packages/app/src/pages/session/timeline/message-timeline.tsx
git commit -m "feat(app): dock workflow composer"
```

---

### Task 6: Add Workflow Shell Smoke Coverage

**Files:**
- Create: `packages/app/e2e/smoke/workflow-shell.spec.ts`
- Modify: `packages/app/e2e/smoke/session-timeline.fixture.ts` only if fixture data is missing required sessions.

**Interfaces:**
- Consumes:
  - Existing Playwright setup.
  - Existing `mockOpenCodeServer`.
  - Existing `session-timeline.fixture`.
- Produces: smoke test asserting workflow shell DOM contract on Home and Session detail.

- [ ] **Step 1: Write failing smoke test**

Create `packages/app/e2e/smoke/workflow-shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"
import { fixture, pageMessages } from "./session-timeline.fixture"

test("workflow shell renders Home and Session detail panel roles", async ({ page }) => {
  await mockOpenCodeServer(page, {
    sessions: fixture.sessions,
    provider: fixture.provider,
    directory: fixture.directory,
    project: fixture.project,
    pageMessages,
  })

  await page.addInitScript((directory) => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem(
      "opencode.global.dat:server",
      JSON.stringify({
        projects: { local: [{ worktree: directory, expanded: true }] },
        lastProject: { local: directory },
      }),
    )
  }, fixture.directory)

  await page.goto("/")
  await expect(page.locator('[data-component="workflow-shell"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="sidebar"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="navigator"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="content"]')).toBeVisible()

  await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
  await expect(page.locator('[data-component="workflow-shell"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="sidebar"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="navigator"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="content"]')).toBeVisible()
})
```

- [ ] **Step 2: Run smoke test**

```powershell
cd D:\project\opencode\packages\app
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:PLAYWRIGHT_PORT='5173'
$env:PLAYWRIGHT_SERVER_HOST='127.0.0.1'
$env:PLAYWRIGHT_SERVER_PORT='4096'
bunx playwright test e2e/smoke/workflow-shell.spec.ts --project=chromium --workers=1 --reporter=line
```

Expected: FAIL if workflow route or mock fixture is incomplete, otherwise PASS. If it fails, use the failure screenshot and console error to fix the exact broken route or selector.

- [ ] **Step 3: Add computed style assertions**

Extend the test with:

```ts
const surfaces = await page.evaluate(() => {
  const read = (selector: string) => {
    const element = document.querySelector(selector)
    if (!element) return null
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      background: style.backgroundColor,
      boxShadow: style.boxShadow,
      width: Math.round(rect.width),
    }
  }

  return {
    shell: read('[data-component="workflow-shell"]'),
    sidebar: read('[data-panel-role="sidebar"]'),
    navigator: read('[data-panel-role="navigator"]'),
    content: read('[data-panel-role="content"]'),
  }
})

expect(surfaces.shell).not.toBeNull()
expect(surfaces.sidebar?.boxShadow).toBe("none")
expect(surfaces.navigator?.boxShadow).not.toBe("none")
expect(surfaces.content?.boxShadow).not.toBe("none")
expect(surfaces.content?.width).toBeGreaterThanOrEqual(440)
```

- [ ] **Step 4: Verify full targeted suite**

```powershell
cd D:\project\opencode\packages\app
bun test src/components/titlebar-workflow.test.ts src/components/workflow-shell-state.test.ts src/components/workflow-ui.test.ts src/pages/home/workflow-task.test.ts src/pages/session/helpers.test.ts
bun typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
cd D:\project\opencode
git add packages/app/e2e/smoke/workflow-shell.spec.ts packages/app/e2e/smoke/session-timeline.fixture.ts
git commit -m "test(app): cover workflow shell smoke"
```

---

### Task 7: Final Verification and Phase-1 Cleanup

**Files:**
- Modify only files with remaining Phase-1 drift found by the checks below.

**Interfaces:**
- Consumes all previous task outputs.
- Produces a verified Phase-1 workflow UI implementation ready for user visual review.

- [ ] **Step 1: Check for banned post-rollback patterns**

Run:

```powershell
cd D:\project\opencode
rg -n "workflow-header-background|workflow-header-border|h-\\[44px\\]|font-weight:620|workflow-shell-local|workflow=\\{|workflow\\?: boolean|HOME_SECTION_LABEL" packages/app/src packages/app/e2e
```

Expected: no matches. `WORKFLOW_SECTION_LABEL` is allowed; `HOME_SECTION_LABEL` is not.

- [ ] **Step 2: Run targeted tests**

```powershell
cd D:\project\opencode\packages\app
bun test src/components/titlebar-workflow.test.ts src/components/workflow-shell-state.test.ts src/components/workflow-ui.test.ts src/pages/home/workflow-task.test.ts src/pages/session/helpers.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run typecheck**

```powershell
cd D:\project\opencode\packages\app
bun typecheck
```

Expected: `tsgo -b` exits successfully.

- [ ] **Step 4: Run workflow smoke**

```powershell
cd D:\project\opencode\packages\app
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:PLAYWRIGHT_PORT='5173'
$env:PLAYWRIGHT_SERVER_HOST='127.0.0.1'
$env:PLAYWRIGHT_SERVER_PORT='4096'
bunx playwright test e2e/smoke/workflow-shell.spec.ts --project=chromium --workers=1 --reporter=line
```

Expected: workflow shell smoke passes.

- [ ] **Step 5: Inspect final worktree scope**

```powershell
cd D:\project\opencode
git status --short
git diff --stat
```

Expected: changed files are limited to workflow UI Phase-1 work plus pre-existing unrelated dirty files. Do not stage unrelated files.

- [ ] **Step 6: Commit verification cleanup if changes were needed**

If Step 1-5 required code changes, commit only those files:

```powershell
cd D:\project\opencode
git add packages/app/src/components/workflow-shell-state.ts packages/app/src/components/workflow-ui.tsx packages/app/src/pages/home.tsx packages/app/src/pages/session.tsx packages/app/src/pages/session/session-side-panel.tsx packages/app/src/pages/session/composer/session-composer-region.tsx packages/app/src/pages/session/timeline/message-timeline.tsx packages/app/e2e/smoke/workflow-shell.spec.ts
git commit -m "chore(app): verify workflow ui closure"
```

If no changes were needed, do not create an empty commit.
