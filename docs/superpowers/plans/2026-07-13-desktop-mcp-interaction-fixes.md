# Desktop MCP Interaction Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复桌面 MCP 新增入口、弹窗滚动和参数删除图标，并提供可检查后保存的单条 JSON/JSONC 配置粘贴流程。

**Architecture:** 纯解析逻辑放入独立的 `mcp-import.ts`，输出既有 `McpForm`，不直接执行持久化。新增方式选择和配置粘贴分别由小型对话框负责，最终复用现有 `DialogMcp` 表单和 mutation；表单内部采用固定头尾、独立滚动区。

**Tech Stack:** SolidJS、Solid Store、Kobalte Dialog、Bun Test、Happy DOM、`jsonc-parser`。

## Global Constraints

- 仅 NeCode 桌面端显示持久化管理入口，非桌面端不得请求 `/mcp/config`。
- 解析或持久化失败必须显示真实错误，不得静默丢字段、猜测条目或返回本地假成功。
- NoteExpress 和 Qingti Base 保持只读。
- 函数不超过 50 行，文件不超过 300 行，公开导出必须有 TSDoc。
- 保留 `packages/app/src/pages/home/workflow-task.test.ts` 的用户未提交修改，不得暂存或提交。

---

### Task 1: Single MCP JSONC Import Parser

**Files:**
- Create: `packages/app/src/components/settings-v2/mcp-import.ts`
- Create: `packages/app/src/components/settings-v2/mcp-import.test.ts`
- Modify: `packages/app/package.json`
- Modify: `bun.lock`

**Interfaces:**
- Consumes: generated `McpLocalConfig`, `McpRemoteConfig` and existing `McpForm`.
- Produces: `parseMcpImport(text: string, scope: "project" | "global"): McpImportResult` where success contains a complete create-mode `McpForm`.

- [ ] **Step 1: Write failing parser tests**

```ts
test("imports one wrapped local MCP entry", () => {
  expect(parseMcpImport(`{ // copied config\n "mcp": { "demo": { "type": "local", "command": ["npx", "-y", "demo"], "environment": { "TOKEN": "x" } } } }`, "project")).toEqual({
    form: expect.objectContaining({ name: "demo", scope: "project", type: "local", command: [{ value: "npx" }, { value: "-y" }, { value: "demo" }] }),
  })
})

test("rejects multiple entries", () => {
  expect(parseMcpImport(`{"mcp":{"a":{"type":"local","command":["a"]},"b":{"type":"local","command":["b"]}}}`, "project")).toEqual({ error: "single_entry" })
})
```

Also cover a direct named entry, remote URL/headers/OAuth, trailing commas, invalid JSONC, unsupported properties, empty command, and prototype-sensitive names.

- [ ] **Step 2: Run tests and verify RED**

Run from `packages/app`:

```powershell
bun test --preload ./happydom.ts ./src/components/settings-v2/mcp-import.test.ts
```

Expected: FAIL because `mcp-import.ts` does not exist.

- [ ] **Step 3: Add the explicit JSONC dependency**

Run from repository root:

```powershell
bun add --cwd packages/app jsonc-parser@3.3.1
```

Expected: `packages/app/package.json` and `bun.lock` record the dependency without upgrading unrelated packages.

- [ ] **Step 4: Implement strict single-entry parsing**

```ts
export type McpImportError = "invalid_jsonc" | "single_entry" | "invalid_entry" | "unsupported_field"
export type McpImportResult = { readonly form: McpForm } | { readonly error: McpImportError }

/** Parses one pasted MCP JSON/JSONC entry without persisting it. */
export function parseMcpImport(text: string, scope: McpForm["scope"]): McpImportResult {
  const errors: ParseError[] = []
  const input: unknown = parse(text, errors, { allowTrailingComma: true })
  if (errors.length > 0) return { error: "invalid_jsonc" }
  const entry = readSingleEntry(input)
  if ("error" in entry) return entry
  return { form: toImportForm(entry.name, entry.config, scope) }
}
```

Validate own properties and exact supported keys before conversion. Reject multiple entries and unknown fields. Never read arbitrary values through inherited properties.

- [ ] **Step 5: Run parser tests and verify GREEN**

Run the Step 2 command. Expected: all parser tests pass with zero failures.

- [ ] **Step 6: Commit Task 1**

```powershell
git add packages/app/package.json bun.lock packages/app/src/components/settings-v2/mcp-import.ts packages/app/src/components/settings-v2/mcp-import.test.ts
git commit -m "feat(app): parse pasted mcp config"
```

---

### Task 2: MCP Add Flow and Scrollable Form

**Files:**
- Create: `packages/app/src/components/settings-v2/dialog-mcp-add.tsx`
- Create: `packages/app/src/components/settings-v2/dialog-mcp-import.tsx`
- Modify: `packages/app/src/components/settings-v2/dialog-mcp.tsx`
- Modify: `packages/app/src/components/settings-v2/mcp-local-fields.tsx`
- Modify: `packages/app/src/components/settings-v2/mcp-key-value-editor.tsx`
- Modify: `packages/ui/src/v2/components/icon.tsx`
- Modify: `packages/app/src/components/settings-v2/settings-v2.css`
- Modify: `packages/app/src/components/settings-v2/mcp-dialog-contract.test.ts`
- Create: `packages/app/src/components/settings-v2/mcp-add-flow.test.tsx`

**Interfaces:**
- Consumes: `parseMcpImport` and `DialogMcp`.
- Produces: `DialogMcpAdd`, `DialogMcpImport`, and optional `initialForm` support on `DialogMcp`.

- [ ] **Step 1: Write failing interaction tests**

```tsx
test("manual add opens the existing form", async () => {
  render(() => <DialogMcpAdd onManual={onManual} onImport={onImport} />)
  fireEvent.click(screen.getByRole("button", { name: "手动配置" }))
  expect(onManual).toHaveBeenCalledTimes(1)
})

test("import parses before opening the form", async () => {
  render(() => <DialogMcpImport scope="project" onContinue={onContinue} />)
  fireEvent.input(screen.getByRole("textbox"), { target: { value: LOCAL_CONFIG } })
  fireEvent.click(screen.getByRole("button", { name: "检查配置" }))
  expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ name: "demo", type: "local" }))
})
```

Add contract assertions that the form has a dedicated scroll region, the footer is outside it, executable row has no remove button, later rows use `xmark-small`, and `Icon` no longer maps unknown names to `plus`.

- [ ] **Step 2: Run tests and verify RED**

Run from `packages/app`:

```powershell
bun test --preload ./happydom.ts ./src/components/settings-v2/mcp-add-flow.test.tsx ./src/components/settings-v2/mcp-dialog-contract.test.ts
```

Expected: FAIL because the add/import dialogs and required structure do not exist.

- [ ] **Step 3: Implement the two-stage add flow**

```tsx
export function DialogMcpAdd(props: { onManual: () => void; onImport: () => void }) {
  return (
    <Dialog title={language.t("settings.mcp.addMethod.title")} fit class="settings-v2-mcp-add-dialog">
      <div class="settings-v2-mcp-add-methods">
        <ButtonV2 onClick={props.onImport}>{language.t("settings.mcp.addMethod.import")}</ButtonV2>
        <ButtonV2 onClick={props.onManual}>{language.t("settings.mcp.addMethod.manual")}</ButtonV2>
      </div>
    </Dialog>
  )
}
```

The import dialog stores `text`, `scope`, and explicit parse error in one `createStore`. `onContinue` receives the parsed form; it does not call the MCP API.

- [ ] **Step 4: Implement fixed header/footer and scrolling body**

```tsx
<form class="settings-v2-mcp-form" onSubmit={controller.submit}>
  <div class="settings-v2-mcp-form-scroll">{fields}</div>
  <McpFormFooter controller={controller} />
</form>
```

Set the dialog container to a viewport-bounded height, `.settings-v2-mcp-form` to `min-height: 0; flex: 1`, and `.settings-v2-mcp-form-scroll` to `overflow-y: auto`.

- [ ] **Step 5: Fix command and key-value removal affordances**

Render no remove button for command index `0`. Render `icon="xmark-small"` for later command rows and key-value rows. Change the v2 icon resolver to throw an explicit error for unknown names instead of silently returning `plus`.

- [ ] **Step 6: Run Task 2 tests and verify GREEN**

Run the Step 2 command. Expected: all tests pass with zero failures.

- [ ] **Step 7: Commit Task 2**

```powershell
git add packages/app/src/components/settings-v2/dialog-mcp-add.tsx packages/app/src/components/settings-v2/dialog-mcp-import.tsx packages/app/src/components/settings-v2/dialog-mcp.tsx packages/app/src/components/settings-v2/mcp-local-fields.tsx packages/app/src/components/settings-v2/mcp-key-value-editor.tsx packages/app/src/components/settings-v2/settings-v2.css packages/app/src/components/settings-v2/mcp-dialog-contract.test.ts packages/app/src/components/settings-v2/mcp-add-flow.test.tsx packages/ui/src/v2/components/icon.tsx
git commit -m "fix(app): improve mcp add dialog"
```

---

### Task 3: Settings Integration, Copy, and Verification

**Files:**
- Modify: `packages/app/src/components/settings-v2/mcp-controller.tsx`
- Modify: `packages/app/src/components/settings-v2/mcp.tsx`
- Modify: `packages/app/src/components/settings-v2/settings-v2.css`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`
- Modify: `packages/app/src/components/settings-v2/mcp-desktop-contract.test.ts`

**Interfaces:**
- Consumes: `DialogMcpAdd`, `DialogMcpImport`, and `DialogMcp` initial form support.
- Produces: final desktop-only add workflow and translated copy.

- [ ] **Step 1: Write failing integration assertions**

```ts
expect(mcpSource).toContain('class="settings-v2-tab-header settings-v2-mcp-header"')
expect(controllerSource).toContain("<DialogMcpAdd")
expect(controllerSource).toContain("<DialogMcpImport")
expect(controllerSource).toContain("initialForm={form}")
```

Assert all new static keys exist in English, Simplified Chinese, and Traditional Chinese dictionaries.

- [ ] **Step 2: Run integration tests and verify RED**

Run from `packages/app`:

```powershell
bun test --preload ./happydom.ts ./src/components/settings-v2/mcp-desktop-contract.test.ts
```

Expected: FAIL because controller wiring, header class, and translations are missing.

- [ ] **Step 3: Wire controller transitions**

Use `dialog.show` to replace the method picker with import or manual form. After successful parsing, replace the import dialog with `DialogMcp initialForm={form}`. Keep existing `management.create.mutateAsync` as the only persistence path.

- [ ] **Step 4: Align the add action to the title row right edge**

Add `settings-v2-mcp-header` and use the established server/RAG header pattern:

```css
.settings-v2-mcp-header .settings-v2-tab-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
```

- [ ] **Step 5: Add complete translations**

Add labels and explicit import errors for method selection, pasted config, scope, check action, invalid JSONC, single-entry requirement, invalid entry, and unsupported fields in `en.ts`, `zh.ts`, and `zht.ts`.

- [ ] **Step 6: Run focused app verification**

From `packages/app`:

```powershell
bun test --preload ./happydom.ts ./src/components/settings-v2/mcp-import.test.ts ./src/components/settings-v2/mcp-add-flow.test.tsx ./src/components/settings-v2/mcp-dialog-contract.test.ts ./src/components/settings-v2/mcp-desktop-contract.test.ts ./src/components/settings-v2/mcp-form.test.ts ./src/components/settings-v2/mcp-model.test.ts
bun typecheck
bun run build
```

Expected: zero test failures, typecheck exit code `0`, production build exit code `0`.

- [ ] **Step 7: Verify repository diff hygiene**

From repository root:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; `workflow-task.test.ts` remains modified but unstaged and absent from feature commits.

- [ ] **Step 8: Verify in NeCode DEV without restarting it**

Use the currently running NeCode DEV window to confirm title alignment, method selection, JSONC import, fixed footer, body scrolling, argument add/remove, environment/header row removal, and visible parse errors. Do not restart the application or server.

- [ ] **Step 9: Commit Task 3**

```powershell
git add packages/app/src/components/settings-v2/mcp-controller.tsx packages/app/src/components/settings-v2/mcp.tsx packages/app/src/components/settings-v2/settings-v2.css packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/app/src/i18n/zht.ts packages/app/src/components/settings-v2/mcp-desktop-contract.test.ts
git commit -m "feat(desktop): guide mcp configuration"
```
