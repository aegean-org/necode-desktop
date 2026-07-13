# Plugin Config and API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must use one inline agent; do not dispatch subagents.

**Goal:** Persist plugin installation and enablement, migrate TUI-only state, and expose the complete typed HTTP/OpenAPI/SDK management surface.

**Architecture:** `PluginConfig` mirrors the proven MCP config-source/config-file/config service split. Typed HttpApi handlers close over stable services, mutate persistent state, mark the instance for disposal after the response, and return explicit public errors.

**Tech Stack:** Effect, FSUtil, jsonc-parser, Flock, HttpApi, OpenAPI generator, Bun tests.

## Global Constraints

- Execute after `2026-07-13-plugin-platform.md`.
- Preserve JSONC comments, order, unrelated fields, and own properties named `__proto__`, `constructor`, or `toString`.
- Do not delete shared npm cache contents when removing configuration.
- Backend tests use `--timeout 60000` from `packages/opencode`.
- Regenerate SDK with `./packages/sdk/js/script/build.ts`.
- Keep the user's existing workflow test modification unstaged.

---

### Task 1: Persistent Plugin Configuration and TUI State Migration

**Files:**
- Create: `packages/opencode/src/plugin/config-source.ts`
- Create: `packages/opencode/src/plugin/config-file.ts`
- Create: `packages/opencode/src/plugin/config.ts`
- Modify: `packages/opencode/src/config/tui.ts`
- Modify: `packages/opencode/src/plugin/tui/runtime.ts`
- Test: `packages/opencode/test/plugin/config-source.test.ts`
- Test: `packages/opencode/test/plugin/config-file.test.ts`
- Test: `packages/opencode/test/plugin/config.test.ts`
- Test: `packages/opencode/test/config/tui.test.ts`

**Interfaces:**
- Consumes: `ConfigPlugin.key`, `PluginCatalog.Entry`.
- Produces: `PluginConfig.list`, `install`, `setEnabled`, `remove` and their Effect Schemas.

- [ ] **Step 1: Write failing JSONC and precedence tests**

```ts
expect(await Bun.file(configFile).text()).toContain("// keep this comment")
expect(entries.find((item) => item.key === "builtin:pdf")?.enabled).toBe(false)
expect(Object.hasOwn(enabled, "__proto__")).toBe(true)
expect(migrated.plugin_enabled["npm:@scope/demo"]).toBe(false)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test test/plugin/config-source.test.ts test/plugin/config-file.test.ts test/plugin/config.test.ts test/config/tui.test.ts --timeout 60000` from `packages/opencode`.
Expected: FAIL because persistent plugin management does not exist.

- [ ] **Step 3: Implement the manager with existing install primitives**

```ts
export interface Interface {
  list(ctx: InstanceContext): Effect.Effect<readonly Entry[], ListFailure>
  install(ctx: InstanceContext, input: InstallInput): Effect.Effect<readonly Entry[], InstallFailure>
  setEnabled(ctx: InstanceContext, key: string, enabled: boolean): Effect.Effect<readonly Entry[], UpdateFailure>
  remove(ctx: InstanceContext, key: string): Effect.Effect<readonly Entry[], RemoveFailure>
}
```

Use `jsonc-parser` edits, `Flock`, atomic writes, and source precedence matching `MCPConfig`. Return a declared `BuiltinRemovalError` for `builtin:*` keys.

- [ ] **Step 4: Migrate TUI state**

Read legacy `tui.plugin_enabled` and TUI KV once, translate known IDs to stable keys, persist top-level `plugin_enabled`, then remove obsolete TUI-only state only after the write succeeds.

- [ ] **Step 5: Run tests and typecheck**

Run: `bun test test/plugin/config-source.test.ts test/plugin/config-file.test.ts test/plugin/config.test.ts test/config/tui.test.ts --timeout 60000 && bun typecheck` from `packages/opencode`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode/src/plugin packages/opencode/src/config/tui.ts packages/opencode/test/plugin packages/opencode/test/config/tui.test.ts
git commit -m "feat(plugin): persist plugin management state"
```

### Task 2: HTTP API, OpenAPI, and Generated SDK

**Files:**
- Create: `packages/opencode/src/server/routes/instance/httpapi/groups/plugin.ts`
- Create: `packages/opencode/src/server/routes/instance/httpapi/handlers/plugin.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/api.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/server.ts`
- Modify: `packages/sdk/openapi.json`
- Modify generated files under: `packages/sdk/js/src/v2/gen/`
- Test: `packages/opencode/test/server/httpapi-plugin.test.ts`

**Interfaces:**
- Consumes: `Plugin.Interface.entries`, `PluginConfig.Interface`.
- Produces SDK methods for status list and four config operations.

- [ ] **Step 1: Write failing endpoint tests**

```ts
expect((await client.plugin.list()).data?.some((item) => item.key === "builtin:documents")).toBe(true)
await client.plugin.config.update({ pluginKey: "builtin:pdf", enabled: false })
expect((await client.plugin.list()).data?.find((item) => item.key === "builtin:pdf")?.status).toBe("disabled")
```

- [ ] **Step 2: Run endpoint tests and verify failure**

Run: `bun test test/server/httpapi-plugin.test.ts --timeout 60000` from `packages/opencode`.
Expected: FAIL because the plugin API group is absent.

- [ ] **Step 3: Declare typed endpoints and explicit errors**

```ts
export const PluginPaths = {
  status: "/plugin",
  config: "/plugin/config",
  entry: "/plugin/config/:pluginKey",
} as const
```

Handlers yield stable services once, call `markInstanceForDisposal` after mutations, and translate every domain failure into a declared `Schema.ErrorClass` response.

- [ ] **Step 4: Run endpoint tests**

Run: `bun test test/server/httpapi-plugin.test.ts --timeout 60000` from `packages/opencode`.
Expected: PASS.

- [ ] **Step 5: Regenerate and verify SDK**

Run: `bun ./packages/sdk/js/script/build.ts` from repo root.
Run: `bun typecheck` from `packages/sdk/js`, then `bun typecheck` from `packages/opencode`.
Expected: generated SDK contains all five operations and both typechecks pass.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode/src/server packages/opencode/test/server/httpapi-plugin.test.ts packages/sdk/openapi.json packages/sdk/js/src/v2/gen
git commit -m "feat(sdk): expose plugin management API"
```
