# Computer Use Activation Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selecting `@电脑` automatically enable Computer Use and show only the current operating system in plugin descriptions.

**Architecture:** Keep plugin persistence on the existing `plugin.config.update` endpoint. Add a small testable preparation helper in the prompt Computer Use module, call it before session activation, and derive the built-in plugin description from `process.platform` through an exported pure helper.

**Tech Stack:** TypeScript, SolidJS, Bun test, generated OpenCode SDK.

## Global Constraints

- Keep `builtin:computer-use` disabled by default.
- Do not bundle Cua Driver or add Cua Skill Pack.
- Selecting `@电脑` is explicit user consent to enable the plugin.
- Do not enter Computer Use unless the `cua-driver` MCP reports `connected`.
- Windows copy mentions only Windows; macOS copy mentions only macOS.
- Preserve real errors and do not roll back a successfully persisted plugin enablement.

---

### Task 1: Automatically enable Computer Use from `@电脑`

**Files:**
- Modify: `packages/app/src/components/prompt-input/computer-use.tsx`
- Modify: `packages/app/src/components/prompt-input/computer-use.test.ts`
- Modify: `packages/app/src/components/prompt-input.tsx`

**Interfaces:**
- Produces: `prepareComputerUse(entry, dependencies): Promise<void>`.
- Consumes: generated `client.plugin.config.update` and `client.mcp.status` SDK calls.

- [x] **Step 1: Write the failing helper tests**

Add tests proving a disabled entry calls `enable("builtin:computer-use")` before reading MCP status, an enabled entry skips persistence, and a failed MCP status rejects with the original Driver error.

- [x] **Step 2: Run the focused test and verify failure**

Run: `bun test src/components/prompt-input/computer-use.test.ts`

Expected: FAIL because `prepareComputerUse` is not exported.

- [x] **Step 3: Implement the preparation helper**

```ts
export async function prepareComputerUse(
  entry: Pick<PluginEntry, "key" | "enabled">,
  dependencies: {
    enable: (key: string) => Promise<unknown>
    status: () => Promise<{ status: string; error?: string } | undefined>
  },
) {
  if (!entry.enabled) await dependencies.enable(entry.key)
  const error = computerUseMcpError(await dependencies.status())
  if (error) throw new Error(error)
}
```

- [x] **Step 4: Replace the read-only detail branch**

Pass the selected plugin entry into `activateComputerUse`, call `prepareComputerUse` before draft or existing-session activation, and remove the `DialogPluginDetail` import and unavailable-entry dialog branch.

- [x] **Step 5: Run the focused App tests**

Run: `bun test src/components/prompt-input/computer-use.test.ts src/components/prompt-input/slash-popover.test.tsx`

Expected: PASS.

### Task 2: Make the plugin description platform-specific

**Files:**
- Modify: `packages/opencode/src/plugin/builtin.ts`
- Modify: `packages/opencode/test/plugin/computer-use.test.ts`

**Interfaces:**
- Produces: `computerUseDescription(platform): string`.
- Consumes: `process.platform` for the default runtime description.

- [x] **Step 1: Write failing platform-copy tests**

Assert `win32` returns `控制 Windows 桌面应用`, `darwin` returns `控制 macOS 桌面应用`, and unsupported platforms return `当前平台暂不支持 Computer Use`.

- [x] **Step 2: Run the focused OpenCode test and verify failure**

Run: `bun test test/plugin/computer-use.test.ts`

Expected: FAIL because `computerUseDescription` is not exported.

- [x] **Step 3: Implement platform-derived copy**

```ts
export function computerUseDescription(platform = process.platform) {
  if (platform === "win32") return "控制 Windows 桌面应用"
  if (platform === "darwin") return "控制 macOS 桌面应用"
  return "当前平台暂不支持 Computer Use"
}
```

Use `computerUseDescription()` in the `builtin:computer-use` manifest.

- [x] **Step 4: Run focused tests and type checks**

Run from `packages/opencode`: `bun test test/plugin/computer-use.test.ts`

Run from `packages/app`: `bun typecheck`

Run from `packages/opencode`: `bun typecheck`

Expected: all commands pass.

- [x] **Step 5: Commit implementation**

```powershell
git add packages/app/src/components/prompt-input.tsx packages/app/src/components/prompt-input/computer-use.tsx packages/app/src/components/prompt-input/computer-use.test.ts packages/opencode/src/plugin/builtin.ts packages/opencode/test/plugin/computer-use.test.ts docs/superpowers/plans/2026-07-16-computer-use-activation.md
git commit -m "fix(desktop): activate computer use from mention"
```
