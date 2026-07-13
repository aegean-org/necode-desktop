# Plugin Integration and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must use one inline agent; do not dispatch subagents.

**Goal:** Register all four productivity plugins as default built-ins, package their runtime dependencies, prove enable/disable behavior end to end, and verify the real desktop interaction and generated artifacts.

**Architecture:** Built-in definitions dynamically import the four workspace plugin packages and mark them user-manageable. Integration tests exercise registry, skills, tools, API, SDK, and desktop UI as one chain; packaging tests ensure runtime dependencies and assets survive the Electron/server bundle boundary.

**Tech Stack:** Bun workspace packages, existing desktop server bundle, app browser tests, Playwright desktop smoke checks, Electron Builder directory build.

## Global Constraints

- Execute after all preceding plugin and productivity plans.
- Productivity plugins are preinstalled, enabled by default, and lazily load heavy format libraries.
- System auth/provider plugins remain visible but cannot be disabled or removed.
- Never claim success from narrow unit tests; verify real DOCX, PDF, XLSX, and PPTX files.
- Do not restart or modify the user's currently running NeCode instance.
- Use a separate temporary desktop QA profile for packaged validation.

---

### Task 1: Register Productivity Plugins as Built-ins

**Files:**
- Create: `packages/opencode/src/plugin/builtin.ts`
- Modify: `packages/opencode/src/plugin/index.ts`
- Modify: `packages/opencode/package.json`
- Test: `packages/opencode/test/plugin/productivity-builtins.test.ts`

**Interfaces:**
- Consumes plugin exports: `DocumentsPlugin`, `PdfPlugin`, `SpreadsheetsPlugin`, `PresentationsPlugin`.
- Produces built-in keys `builtin:documents`, `builtin:pdf`, `builtin:spreadsheets`, `builtin:presentations`.

- [ ] **Step 1: Write failing built-in registry tests**

```ts
const entries = await plugin.entries()
expect(entries.filter((item) => item.key.startsWith("builtin:") && !item.system).map((item) => item.key).toSorted()).toEqual([
  "builtin:documents", "builtin:pdf", "builtin:presentations", "builtin:spreadsheets",
])
expect(entries.find((item) => item.key === "builtin:pdf")).toMatchObject({ enabled: true, canDisable: true, canUninstall: false })
```

- [ ] **Step 2: Run test and verify failure**

Run: `bun test test/plugin/productivity-builtins.test.ts --timeout 60000` from `packages/opencode`.
Expected: FAIL because the built-ins are not registered.

- [ ] **Step 3: Add structured dynamic built-ins**

```ts
export const ProductivityBuiltins: readonly BuiltinPluginDefinition[] = [
  {
    key: "builtin:documents",
    manifest: DocumentsManifest,
    root: DocumentsRoot,
    canDisable: true,
    system: false,
    server: async (input) => (await import("@necode-ai/plugin-documents")).DocumentsPlugin(input),
  },
]
```

Add all four entries and workspace dependencies. Keep existing auth/provider definitions in the same typed list with `system: true` and `canDisable: false`.

- [ ] **Step 4: Run test and typecheck**

Run: `bun test test/plugin/productivity-builtins.test.ts --timeout 60000 && bun typecheck` from `packages/opencode`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/plugin packages/opencode/package.json packages/opencode/test/plugin/productivity-builtins.test.ts bun.lock
git commit -m "feat(plugin): register productivity builtins"
```

### Task 2: Package Runtime Dependencies and Assets

**Files:**
- Modify: `packages/desktop/package.json`
- Modify: `packages/desktop/src/main/server-bundle-runtime-deps.test.ts`
- Modify: `packages/desktop/scripts/prebuild.ts`
- Test: `packages/desktop/desktop-package-workflow.test.ts`

**Interfaces:**
- Produces packaged access to four workspace plugins, dynamic dependencies, and the PDF font/OFL assets.

- [ ] **Step 1: Write failing bundle dependency tests**

```ts
expect(pkg.dependencies?.["@necode-ai/plugin-documents"]).toBe("workspace:*")
expect(pkg.dependencies?.["docx"]).toBe("9.5.1")
expect(await Bun.file(path.join(bundle, "plugin-pdf", "assets", "OFL.txt")).exists()).toBe(true)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test src/main/server-bundle-runtime-deps.test.ts desktop-package-workflow.test.ts` from `packages/desktop`.
Expected: FAIL because plugin dependencies/assets are not packaged.

- [ ] **Step 3: Extend server bundle dependency copying**

Copy workspace plugin packages, dynamic node modules, and declared plugin assets into the desktop server bundle. Preserve package-relative paths so manifest skill and font resolution work unchanged after packaging.

- [ ] **Step 4: Run desktop tests and typecheck**

Run: `bun test src/main/server-bundle-runtime-deps.test.ts desktop-package-workflow.test.ts && bun typecheck` from `packages/desktop`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop package.json bun.lock
git commit -m "chore(desktop): package productivity plugins"
```

### Task 3: End-to-End Runtime and Artifact Tests

**Files:**
- Create: `packages/opencode/test/plugin/productivity-integration.test.ts`
- Create: `packages/app/e2e/smoke/plugin-center.spec.ts`
- Modify: `packages/app/e2e/utils/mock-server.ts`

**Interfaces:**
- Verifies registry → skill discovery → tool registry → output attachment chain.

- [ ] **Step 1: Write integration tests for default and disabled states**

```ts
expect(await registry.ids()).toContain("document_create")
expect((await skills.all()).map((item) => item.name)).toContain("documents")
await pluginConfig.setEnabled(ctx, "builtin:documents", false)
await instanceStore.dispose(ctx)
expect(await nextRegistry.ids()).not.toContain("document_create")
expect((await nextSkills.all()).map((item) => item.name)).not.toContain("documents")
```

- [ ] **Step 2: Add one real artifact smoke call per plugin**

Create Chinese sample content, execute each create tool, require one attachment with the correct MIME, and reopen the resulting file using its plugin's validation reader.

- [ ] **Step 3: Run backend integration tests**

Run: `bun test test/plugin/productivity-integration.test.ts --timeout 60000` from `packages/opencode`.
Expected: PASS for default enablement, disablement, re-enable, skills, tools, and four real artifacts.

- [ ] **Step 4: Add browser E2E coverage**

```ts
await page.getByRole("tab", { name: "插件" }).click()
await expect(page.getByText("Documents")).toBeVisible()
await page.getByRole("switch", { name: "Documents" }).click()
await expect(page.getByText("已停用")).toBeVisible()
```

Cover npm install preview, local picker UI, removal, failed status detail, system section, and status popover.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/test/plugin/productivity-integration.test.ts packages/app/e2e/smoke/plugin-center.spec.ts packages/app/e2e/utils/mock-server.ts
git commit -m "test(plugin): cover productivity integration"
```

### Task 4: Full Automated and Packaged Desktop Verification

**Files:**
- No source changes unless a failing verification exposes a root-cause defect.

- [ ] **Step 1: Run package typechecks**

Run `bun typecheck` from `packages/core`, `packages/plugin`, `packages/plugin-artifacts`, all four productivity packages, `packages/opencode`, `packages/sdk/js`, `packages/app`, and `packages/desktop`.
Expected: all PASS.

- [ ] **Step 2: Run focused automated suites**

Run backend plugin tests with `--timeout 60000`, each productivity package's `bun test`, app `bun run test:unit && bun run test:browser`, and desktop bundle tests.
Expected: all PASS with no skipped plugin management coverage.

- [ ] **Step 3: Audit generated and packaged files**

Run: `bun ./packages/sdk/js/script/build.ts`, `git diff --check`, and `git status --short` from repo root.
Expected: OpenAPI and SDK are synchronized; only intended files and the user's pre-existing workflow test modification remain.

- [ ] **Step 4: Build an unpacked Windows desktop**

Run: `$env:NECODE_SKIP_CODE_SIGNING='1'; bun run package:win:dir` from `packages/desktop`.
Expected: `packages/desktop/dist/win-unpacked` contains the NeCode executable, server bundle, four plugin packages, skills, and PDF font license.

- [ ] **Step 5: Verify with a separate QA profile**

Launch the unpacked executable with `--user-data-dir=$env:TEMP\necode-plugin-qa`, use computer control to open Settings → Plugins, verify the four default active entries, toggle PDF, inspect a system component, and run one conversation request for each output format. Do not close or restart the user's existing NeCode instance.

- [ ] **Step 6: Inspect all generated files**

Open the DOCX, PDF, XLSX, and PPTX from their message attachments. Confirm Chinese text, expected structure, and application-level readability; record exact paths and screenshots in the completion report.

- [ ] **Step 7: Close verification defects at their owning task**

If verification exposes a defect, return to the task that owns the failing file, add a regression test there, rerun that task's focused verification, and use that task's exact commit command. When no defect remains, do not create an empty verification commit.
