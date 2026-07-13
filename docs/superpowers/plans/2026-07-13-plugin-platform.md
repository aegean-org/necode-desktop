# Plugin Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must use one inline agent; do not dispatch subagents.

**Goal:** Build the unified plugin catalog, persistent enablement, real runtime status, plugin-provided skill discovery, management HTTP API, OpenAPI, and SDK contract required by the desktop plugin center.

**Architecture:** A manifest-only `PluginCatalog` resolves built-in and configured plugins without depending on Hook execution. `Plugin.Service` consumes the catalog, records every load outcome in a registry, and exposes both hooks and entries. Persistent writes mirror the MCP config manager and invalidate the current instance after successful mutations.

**Tech Stack:** Effect Schema and services, Bun, JSONC parser, existing PluginLoader/PluginMeta, Effect HttpApi, generated JavaScript SDK.

## Global Constraints

- Preserve existing string and tuple plugin configuration forms.
- Add top-level `plugin_enabled`; missing entries mean enabled.
- Preserve JSONC comments, property order, unrelated fields, and prototype-sensitive keys.
- Expose failures as `install`, `manifest`, `compatibility`, `entry`, `load`, or `initialize`.
- Backend test commands run from `packages/opencode` with a hard timeout of 60 seconds.
- Regenerate the SDK with `./packages/sdk/js/script/build.ts`.
- Start execution in an isolated worktree on branch `plugin-center`; never copy the user's dirty workflow test into it.
- Do not touch the user's existing `packages/app/src/pages/home/workflow-task.test.ts` modification.

---

### Task 1: Public Config, Manifest, and Tool Artifact Contracts

**Files:**
- Modify: `packages/core/src/v1/config/plugin.ts`
- Modify: `packages/core/src/v1/config/config.ts`
- Modify: `packages/core/src/config/plugin.ts`
- Modify: `packages/core/src/config.ts`
- Create: `packages/plugin/src/manifest.ts`
- Modify: `packages/plugin/src/index.ts`
- Modify: `packages/plugin/src/tool.ts`
- Test: `packages/core/test/config/config.test.ts`
- Test: `packages/opencode/test/config/plugin.test.ts`

**Interfaces:**
- Produces: `PluginManifest`, `PluginCapability`, `PluginFailureStage`, `ConfigPlugin.Enabled`, `ConfigPluginV1.Enabled`.
- Produces: `ToolContext.artifact(filename): Promise<{ path: string; url: string }>`.

- [ ] **Step 1: Write failing schema and public API tests**

```ts
expect(Schema.decodeUnknownSync(ConfigV1.Info)({ plugin_enabled: { "builtin:pdf": false } }).plugin_enabled).toEqual({
  "builtin:pdf": false,
})
expect(Schema.decodeUnknownSync(PluginManifest)({
  id: "documents",
  name: "Documents",
  skills: ["./skills/"],
})).toMatchObject({ id: "documents", name: "Documents" })
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `bun test test/config/config.test.ts --timeout 60000` from `packages/core`.
Run: `bun test test/config/plugin.test.ts --timeout 60000` from `packages/opencode`.
Expected: FAIL because `plugin_enabled`, `PluginManifest`, and `artifact` do not exist.

- [ ] **Step 3: Add the public schemas and documented artifact method**

```ts
export const Enabled = Schema.Record(Schema.String, Schema.Boolean)

export const PluginManifest = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.String),
  skills: Schema.optional(Schema.Array(Schema.String)),
})

export type PluginFailureStage = "install" | "manifest" | "compatibility" | "entry" | "load" | "initialize"
```

Add `plugin_enabled` to both config generations and add a TSDoc block to `ToolContext.artifact` explaining that it allocates a session-scoped path under NeCode data storage.

- [ ] **Step 4: Run schema and type checks**

Run: `bun test test/config/config.test.ts --timeout 60000 && bun typecheck` from `packages/core`.
Run: `bun typecheck` from `packages/plugin`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core packages/plugin packages/opencode/test/config/plugin.test.ts
git commit -m "feat(plugin): define plugin platform contracts"
```

### Task 2: Stable Keys, Manifest Reader, and Plugin Catalog

**Files:**
- Create: `packages/opencode/src/plugin/catalog.ts`
- Modify: `packages/opencode/src/plugin/shared.ts`
- Modify: `packages/opencode/src/config/plugin.ts`
- Test: `packages/opencode/test/plugin/catalog.test.ts`
- Test: `packages/opencode/test/plugin/shared.test.ts`

**Interfaces:**
- Produces: `PluginCatalog.Entry`, `PluginCatalog.builtins`, `PluginCatalog.entries()`.
- Produces: `ConfigPlugin.key(spec): string` and `readPluginManifest(pkg): PluginManifest | undefined`.

- [ ] **Step 1: Write catalog tests with real temporary packages**

```ts
expect(ConfigPlugin.key("@scope/demo@1.2.3")).toBe("npm:@scope/demo")
expect(ConfigPlugin.key(pathToFileURL(file).href)).toBe(`file:${Filesystem.resolve(file)}`)
expect(entry.manifest?.skills).toEqual([path.join(pkgDir, "skills")])
expect(entry.canDisable).toBe(true)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test test/plugin/catalog.test.ts test/plugin/shared.test.ts --timeout 60000` from `packages/opencode`.
Expected: FAIL because the catalog and stable key functions do not exist.

- [ ] **Step 3: Implement manifest-safe catalog resolution**

```ts
export type Entry = {
  key: string
  spec: string
  source: "builtin" | "npm" | "file"
  scope: "builtin" | "global" | "local"
  enabled: boolean
  system: boolean
  canDisable: boolean
  canUninstall: boolean
  manifest?: PluginManifest
  resolved?: PluginLoader.Resolved
  failure?: { stage: PluginFailureStage; message: string }
}
```

Resolve every manifest path with `Filesystem.contains(pkg.dir, resolved)` and return a `manifest` failure instead of ignoring invalid paths.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `bun test test/plugin/catalog.test.ts test/plugin/shared.test.ts --timeout 60000 && bun typecheck` from `packages/opencode`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/plugin packages/opencode/src/config/plugin.ts packages/opencode/test/plugin
git commit -m "feat(plugin): add unified plugin catalog"
```

### Task 3: Runtime Registry, Artifact Allocation, and Skill Discovery

**Files:**
- Create: `packages/opencode/src/plugin/registry.ts`
- Modify: `packages/opencode/src/plugin/index.ts`
- Modify: `packages/opencode/src/tool/registry.ts`
- Modify: `packages/opencode/src/skill/index.ts`
- Test: `packages/opencode/test/plugin/registry.test.ts`
- Test: `packages/opencode/test/plugin/trigger.test.ts`
- Test: `packages/opencode/test/skill/plugin-skill.test.ts`

**Interfaces:**
- Produces: `Plugin.Interface.entries(): Effect<readonly PluginRegistry.Entry[]>`.
- Consumes: `PluginCatalog.Entry`.

- [ ] **Step 1: Write failing runtime and skill tests**

```ts
expect((await plugin.entries()).find((item) => item.key === "npm:broken")?.status).toBe("failed")
expect((await skill.all()).map((item) => item.name)).toContain("demo-skill")
expect(await Bun.file(artifact.path).exists()).toBe(false)
expect(artifact.url).toBe(pathToFileURL(artifact.path).href)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test test/plugin/registry.test.ts test/plugin/trigger.test.ts test/skill/plugin-skill.test.ts --timeout 60000` from `packages/opencode`.
Expected: FAIL because runtime entries, plugin skill roots, and artifact allocation are absent.

- [ ] **Step 3: Store explicit runtime outcomes**

```ts
export type Entry = PluginCatalog.Entry & {
  status: "active" | "disabled" | "failed" | "incompatible"
  tools: readonly string[]
  skills: readonly string[]
  error?: { stage: PluginFailureStage; message: string }
}
```

Replace bare internal plugin functions with structured built-in definitions. Keep provider/auth/NeCode plugins as `system: true`, `canDisable: false`; record initialization failures instead of only logging them.

- [ ] **Step 4: Add session artifact allocation and plugin skill roots**

```ts
const root = path.join(Global.Path.data, "artifacts", toolCtx.sessionID)
const target = path.join(root, sanitizeFilename(filename))
await fs.mkdir(root, { recursive: true })
return { path: target, url: pathToFileURL(target).href }
```

Feed enabled catalog skill directories into `discoverSkills`; disabled or failed plugins contribute no skills.

- [ ] **Step 5: Run tests and typecheck**

Run: `bun test test/plugin/registry.test.ts test/plugin/trigger.test.ts test/skill/plugin-skill.test.ts --timeout 60000 && bun typecheck` from `packages/opencode`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode/src/plugin packages/opencode/src/tool/registry.ts packages/opencode/src/skill packages/opencode/test/plugin packages/opencode/test/skill
git commit -m "feat(plugin): expose runtime registry and skills"
```
