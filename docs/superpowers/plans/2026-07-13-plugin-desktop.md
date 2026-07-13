# Desktop Plugin Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must use one inline agent; do not dispatch subagents.

**Goal:** Add a Craft-aligned desktop plugin center with real status, search, details, npm/local installation, enablement, removal, and corrected status-popover behavior.

**Architecture:** A focused client/model/controller split mirrors the existing MCP settings pattern. The settings page renders normalized registry entries and opens standard v2 dialogs; native path selection stays behind the platform abstraction.

**Tech Stack:** SolidJS, TanStack Solid Query, generated SDK, existing v2 settings components, Electron native picker abstraction, Bun browser/unit tests.

## Global Constraints

- Execute after both plugin platform plans.
- Add “插件” between MCP and 技能 in settings navigation.
- Show built-in productivity plugins, installed plugins, and collapsed read-only system components.
- Never derive success from `config.plugin`; use `/plugin` status.
- The add action stays at the right side of the title row.
- Rows are clickable; switches and menus stop propagation.
- Keep files below 300 lines and functions below 50 lines.
- Preserve the user's existing workflow test modification.

---

### Task 1: SDK Client Adapter and Pure View Model

**Files:**
- Create: `packages/app/src/components/settings-v2/plugin-client.ts`
- Create: `packages/app/src/components/settings-v2/plugin-model.ts`
- Test: `packages/app/src/components/settings-v2/plugin-client.test.ts`
- Test: `packages/app/src/components/settings-v2/plugin-model.test.ts`

**Interfaces:**
- Produces: `pluginClient(directory, serverSDK)`.
- Produces: `pluginSections(entries, filter)` and `pluginStatusLabel(status)`.

- [ ] **Step 1: Write failing adapter and grouping tests**

```ts
expect(pluginSections(entries, "pdf").builtin.map((item) => item.key)).toEqual(["builtin:pdf"])
expect(pluginSections(entries, "").system.every((item) => !item.canDisable)).toBe(true)
await pluginClient(directory, sdk).setEnabled("builtin:pdf", false)
expect(update).toHaveBeenCalledWith({ pluginKey: "builtin:pdf", enabled: false })
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test --preload ./happydom.ts ./src/components/settings-v2/plugin-client.test.ts ./src/components/settings-v2/plugin-model.test.ts` from `packages/app`.
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement narrow client and immutable grouping**

```ts
export function pluginSections(entries: readonly PluginEntry[], raw: string) {
  const query = raw.trim().toLocaleLowerCase()
  const visible = entries.filter((item) => matchesPlugin(item, query))
  return {
    builtin: visible.filter((item) => item.source === "builtin" && !item.system),
    installed: visible.filter((item) => item.source !== "builtin"),
    system: visible.filter((item) => item.system),
  }
}
```

Client methods call generated SDK operations with `throwOnError: true` and never edit config text from the browser.

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test --preload ./happydom.ts ./src/components/settings-v2/plugin-client.test.ts ./src/components/settings-v2/plugin-model.test.ts && bun typecheck` from `packages/app`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/components/settings-v2/plugin-client* packages/app/src/components/settings-v2/plugin-model*
git commit -m "feat(app): model desktop plugin management"
```

### Task 2: Settings Navigation, List, and Plugin Detail

**Files:**
- Create: `packages/app/src/components/settings-v2/plugins.tsx`
- Create: `packages/app/src/components/settings-v2/plugin-controller.tsx`
- Create: `packages/app/src/components/settings-v2/dialog-plugin-detail.tsx`
- Modify: `packages/app/src/components/settings-v2/dialog-settings-v2.tsx`
- Modify: `packages/app/src/components/settings-v2/settings-v2.css`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/en.ts`
- Test: `packages/app/src/components/settings-v2/plugin-page.test.ts`

**Interfaces:**
- Consumes: `pluginClient`, `pluginSections`, SDK `PluginEntry`.
- Produces: `SettingsPluginsV2` and `usePluginSettings`.

- [ ] **Step 1: Write failing page-contract tests**

```ts
expect(source).toContain('<TabsV2.Trigger value="plugins">')
expect(source).toContain("settings.plugins.action.install")
expect(source).toContain("event.stopPropagation()")
expect(detailSource).toContain("entry.error.stage")
expect(detailSource).toContain("entry.error.message")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test --preload ./happydom.ts ./src/components/settings-v2/plugin-page.test.ts` from `packages/app`.
Expected: FAIL because the plugin settings tab and details do not exist.

- [ ] **Step 3: Implement controller queries and refresh**

```ts
const status = useQuery(() => ({
  queryKey: [serverSDK().scope, directory(), "settings", "plugins"],
  enabled: desktop() && !!directory(),
  queryFn: () => client().list(),
}))

const refresh = () => Promise.all([status.refetch(), config.refetch()])
```

Mutations disable controls while pending, call `requestFailed` with the real SDK error, and refresh both status and config.

- [ ] **Step 4: Implement Craft-style rows and detail dialog**

```tsx
<button class="settings-v2-plugin-row" onClick={() => props.onOpen(props.entry)}>
  <PluginLead entry={props.entry} />
  <div onClick={(event) => event.stopPropagation()}>
    <Switch checked={props.entry.enabled} disabled={!props.entry.canDisable || props.pending} />
  </div>
</button>
```

System components render in a collapsed section and have no switch or removal action. Failed entries show critical status and both failure stage and message.

- [ ] **Step 5: Run tests and typecheck**

Run: `bun test --preload ./happydom.ts ./src/components/settings-v2/plugin-page.test.ts && bun typecheck` from `packages/app`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/components/settings-v2 packages/app/src/i18n/zh.ts packages/app/src/i18n/en.ts
git commit -m "feat(app): add desktop plugin center"
```

### Task 3: npm and Local Plugin Installation, Removal, and Native Picker

**Files:**
- Create: `packages/app/src/components/settings-v2/dialog-plugin-install.tsx`
- Create: `packages/app/src/components/settings-v2/dialog-plugin-remove.tsx`
- Create: `packages/app/src/components/settings-v2/plugin-install-model.ts`
- Test: `packages/app/src/components/settings-v2/plugin-install-model.test.ts`
- Test: `packages/app/test-browser/plugin-install.browser.test.tsx`

**Interfaces:**
- Consumes: `Platform.openDirectoryPickerDialog`, `Platform.openFilePathPickerDialog`, `pluginClient.install/remove`.
- Produces: `PluginInstallResult = { spec: string; scope: "local" | "global" }`; the UI labels `local` as “当前项目”.

- [ ] **Step 1: Write failing form and browser tests**

```ts
expect(normalizeNpmSpec("  @scope/demo  ")).toBe("@scope/demo")
expect(normalizeLocalSpec("  C:\\plugins\\demo  ")).toBe("C:\\plugins\\demo")
await page.getByRole("button", { name: "选择插件目录" }).click()
expect(openDirectoryPickerDialog).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test --preload ./happydom.ts ./src/components/settings-v2/plugin-install-model.test.ts` from `packages/app`.
Run: `bun test --conditions=browser --preload ./solid-happydom.ts ./test-browser/plugin-install.browser.test.tsx` from `packages/app`.
Expected: FAIL because install flow files do not exist.

- [ ] **Step 3: Implement the two installation methods**

```ts
type InstallMethod = "npm" | "local"
type InstallScope = "local" | "global"

export function normalizeNpmSpec(value: string) {
  const spec = value.trim()
  if (!spec) throw new Error("Plugin package name is required")
  return spec
}

export function normalizeLocalSpec(value: string) {
  const spec = value.trim()
  if (!spec) throw new Error("Plugin path is required")
  return spec
}
```

The local method offers separate “选择插件目录” and “选择入口文件” buttons. It displays the selected path read-only; it does not require manual Windows path entry.

- [ ] **Step 4: Implement removal confirmation**

The dialog names the plugin and scope, calls the remove endpoint once, closes only after success, and never appears for `canUninstall: false`.

- [ ] **Step 5: Run tests and typecheck**

Run the two focused commands from Step 2, then `bun typecheck` from `packages/app`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/components/settings-v2/dialog-plugin-* packages/app/src/components/settings-v2/plugin-install-* packages/app/test-browser/plugin-install.browser.test.tsx
git commit -m "feat(app): install and remove plugins"
```

### Task 4: Status Popover and Full Desktop Regression Coverage

**Files:**
- Modify: `packages/app/src/components/status-popover-body.tsx`
- Create: `packages/app/src/components/plugin-status-query.ts`
- Create: `packages/app/src/components/status-popover-plugin.test.ts`
- Create: `packages/app/test-browser/plugin-management.browser.test.tsx`
- Modify remaining locale files under: `packages/app/src/i18n/`

**Interfaces:**
- Consumes: runtime `/plugin` query.
- Removes: configured-plugin fixed green status behavior.

- [ ] **Step 1: Write failing status-popover test**

```ts
expect(source).not.toContain("sync().data.config.plugin")
expect(source).not.toContain('bg-icon-success-base" />')
expect(statusClass("failed")).toContain("critical")
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test --preload ./happydom.ts ./src/components/status-popover-plugin.test.ts` from `packages/app`.
Expected: FAIL because the popover still renders configured entries as successful.

- [ ] **Step 3: Query and render real registry status**

Enable the query only while the popover is shown and a project directory exists. Render active, disabled, failed, and incompatible classes from registry state; show a “管理插件” action opening the plugin settings tab.

- [ ] **Step 4: Cover the complete browser flow**

```ts
await user.click(screen.getByRole("button", { name: "安装插件" }))
await user.click(screen.getByRole("tab", { name: "本地插件" }))
await user.click(screen.getByRole("button", { name: "选择插件目录" }))
expect(await screen.findByText("C:\\plugins\\demo")).toBeVisible()
```

Also cover row click versus switch propagation, collapsed system components, long names, long errors, and narrow dialog width.

- [ ] **Step 5: Run app verification**

Run: `bun run test:unit && bun run test:browser && bun typecheck` from `packages/app`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/components/status-popover-body.tsx packages/app/src/components/plugin-status-query.ts packages/app/src/components/status-popover-plugin.test.ts packages/app/src/i18n packages/app/test-browser/plugin-management.browser.test.tsx
git commit -m "fix(app): show real plugin status"
```
