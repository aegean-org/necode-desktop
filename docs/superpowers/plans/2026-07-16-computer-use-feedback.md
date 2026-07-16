# Computer Use Feedback Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit pending feedback to plugin toggles and guide active Computer Use sessions toward reliable Cua app launching with honest Shell fallback reporting.

**Architecture:** Keep plugin mutations and error Toasts unchanged, deriving an optimistic switch/status view from the existing mutation variables. Add a pure Computer Use system-prompt helper beside the session gating logic and append it only when session metadata has Computer Use enabled.

**Tech Stack:** TypeScript, SolidJS, TanStack Solid Query, Bun test, Effect session runtime.

## Global Constraints

- Use the same pending interaction for every user-manageable plugin.
- Do not add new backend endpoints or hide real plugin failures.
- Computer Use instructions apply only to sessions with `metadata.computerUse.enabled === true`.
- Prefer Cua tools over Shell; Shell remains an explicit fallback after a real Cua failure.
- Do not bundle Cua Driver or add Cua Skill Pack.

---

### Task 1: Plugin Toggle Pending Feedback

**Files:**
- Modify: `packages/app/src/components/settings-v2/plugin-model.ts`
- Modify: `packages/app/src/components/settings-v2/plugin-model.test.ts`
- Modify: `packages/app/src/components/settings-v2/plugin-row.tsx`
- Modify: `packages/app/src/components/settings-v2/plugins.tsx`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`

**Interfaces:**
- Produces: `pluginToggleState(enabled, pending, pendingEnabled)` returning the displayed switch value and optional pending status translation key.
- Consumes: `management.toggle.variables.enabled` from the existing mutation.

- [x] **Step 1: Write failing model tests**

Add assertions that a pending enable displays `checked: true` with `settings.plugins.status.enabling`, a pending disable displays `checked: false` with `settings.plugins.status.disabling`, and an idle row preserves the server value without a pending label.

- [x] **Step 2: Run the focused test and verify failure**

Run from `packages/app`:

```powershell
bun test src/components/settings-v2/plugin-model.test.ts
```

Expected: fail because `pluginToggleState` is not exported.

- [x] **Step 3: Implement the pure display-state helper**

```ts
export function pluginToggleState(enabled: boolean, pending: boolean, pendingEnabled?: boolean) {
  if (!pending || pendingEnabled === undefined) return { checked: enabled }
  return {
    checked: pendingEnabled,
    status: pendingEnabled ? "settings.plugins.status.enabling" : "settings.plugins.status.disabling",
  }
}
```

- [x] **Step 4: Render optimistic state and Spinner**

Pass the pending target value from `plugins.tsx` into `PluginRow`. In `plugin-row.tsx`, use `pluginToggleState`, render `Spinner` beside the disabled switch while pending, and replace the normal status tag with the translated pending status until the mutation settles.

- [x] **Step 5: Add localized pending labels**

Add:

```text
settings.plugins.status.enabling = Enabling... / 启用中… / 啟用中…
settings.plugins.status.disabling = Disabling... / 停用中… / 停用中…
```

- [x] **Step 6: Run App tests and typecheck**

Run from `packages/app`:

```powershell
bun test src/components/settings-v2/plugin-model.test.ts src/components/settings-v2/plugin-page.test.ts
bun typecheck
```

Expected: all pass.

### Task 2: Computer Use Launch and Fallback Instructions

**Files:**
- Modify: `packages/opencode/src/session/computer-use.ts`
- Modify: `packages/opencode/src/session/prompt.ts`
- Modify: `packages/opencode/test/session/computer-use.test.ts`

**Interfaces:**
- Produces: `SessionComputerUse.systemPrompt(session): string | undefined`.
- Consumes: existing `SessionComputerUse.enabled(session)` and the session system prompt array.

- [x] **Step 1: Write failing instruction tests**

Assert inactive sessions return `undefined`. Assert active sessions receive instructions containing `list_apps`, `pid`, `launch_path`, `aumid`, `launch_app.urls`, state verification before fallback, and explicit Shell fallback disclosure.

- [x] **Step 2: Run the focused test and verify failure**

Run from `packages/opencode`:

```powershell
bun test test/session/computer-use.test.ts
```

Expected: fail because `SessionComputerUse.systemPrompt` is not implemented.

- [x] **Step 3: Implement the active-session system prompt**

Create a constant instruction string in `session/computer-use.ts` and return it only when `enabled(session)` is true. The instructions must require exact identifiers returned by `list_apps`, reuse running PIDs, use `launch_app.urls` for URLs, verify state after Cua errors, and disclose successful Shell fallback in the user's language.

- [x] **Step 4: Append the prompt to active provider turns**

Import `SessionComputerUse` in `session/prompt.ts`, compute `const computerUse = SessionComputerUse.systemPrompt(session)`, and append it to the existing `system` array only when defined.

- [x] **Step 5: Run OpenCode tests and typecheck**

Run from `packages/opencode`:

```powershell
bun test test/session/computer-use.test.ts
bun typecheck
```

Expected: all pass.

- [x] **Step 6: Commit the implementation**

```powershell
git add docs/superpowers/plans/2026-07-16-computer-use-feedback.md packages/app/src/components/settings-v2 packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/app/src/i18n/zht.ts packages/opencode/src/session/computer-use.ts packages/opencode/src/session/prompt.ts packages/opencode/test/session/computer-use.test.ts
git commit -m "fix(desktop): improve computer use feedback"
```
