# 桌面端自定义 MCP 管理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 NeCode 桌面端设置中实现可持久化的项目级/全局自定义 MCP 新增、编辑、移除、连接和 OAuth 管理。

**Architecture:** 在 Sidecar 运行时新增独立的 JSONC 文件编辑边界和 MCP 配置管理器，通过类型化 HttpApi 暴露持久化 CRUD，并在写盘成功后沿用现有实例销毁生命周期重新加载配置。桌面渲染层使用生成的 SDK，把纯配置/表单模型与 SolidJS 对话框、列表渲染分离；共享 Web 界面继续使用现有状态接口，不加载持久化配置。

**Tech Stack:** TypeScript、Effect、Effect Schema、jsonc-parser、SolidJS、TanStack Solid Query、Settings v2 UI、Bun test、生成式 JavaScript SDK、NeCode Electron Sidecar。

## Global Constraints

- 工作目录固定为 `D:\project\opencode`，不创建 Worktree，保证当前 NeCode DEV 能接收热更新。
- 只新增桌面端自定义 MCP 管理入口；共享 Web、CLI、TUI 不新增入口，也不修改 CLI 行为。
- NoteExpress 和 Qingti Base 的保留 ID 为 `noteexpress`、`qingtibase`，始终只读。
- 项目作用域只写 `opencode.json` / `opencode.jsonc`，绝不写 `config.json`。
- JSONC 注释和无关格式必须保留；持久化失败不得降级为仅内存成功。
- 本地命令按参数数组保存，服务端不得进行 Shell 字符串切分。
- OAuth 模式严格映射为：自动检测省略 `oauth`、禁用保存 `oauth: false`、显式配置保存对象。
- 所有后端测试命令必须设置 60 秒硬超时；测试与 `bun typecheck` 均从包目录运行。
- 遵守 50 行函数、300 行文件、最多 3 层嵌套和最多 10 圈复杂度限制。
- 保留工作区已有的 `packages/app/src/pages/home/workflow-task.test.ts` 未提交修改，不得覆盖或混入无关提交。
- 不返回模拟成功、不吞错误、不引入静默回退。
- 按 `packages/app/AGENTS.md`，代理不得主动重启应用或服务进程。

---

### Task 1: 建立保留 JSONC 的 MCP 文件编辑边界

**Files:**
- Create: `packages/opencode/src/mcp/config-file.ts`
- Create: `packages/opencode/test/mcp/config-file.test.ts`

**Interfaces:**
- Produces: `MCPConfigFile.Document`，包含 `path`、原始 `text` 和解析后的 `mcp`。
- Produces: `MCPConfigFile.read(input)`、`set(input)`、`remove(input)`。
- Consumes: `FSUtil.Interface`、`ConfigMCPV1.Info`。

- [ ] **Step 1: 编写 JSONC 保留行为的失败测试**

使用真实临时目录和真实文件，不使用 Mock。测试文件先写入带注释的配置：

```ts
const source = path.join(tmp.path, "opencode.jsonc")
await Bun.write(
  source,
  `{
  // keep this comment
  "theme": "necode",
  "mcp": {
    "old": { "type": "local", "command": ["echo", "old"] }
  }
}`,
)
```

断言 `set` 新增远程项后保留注释和 `theme`，`remove` 删除最后一个 MCP 时移除空的 `mcp` 父对象：

```ts
yield* MCPConfigFile.set({
  fs,
  path: source,
  name: "remote",
  config: { type: "remote", url: "https://example.com/mcp" },
})
expect(await Bun.file(source).text()).toContain("// keep this comment")
expect(parse(await Bun.file(source).text()).theme).toBe("necode")

yield* MCPConfigFile.remove({ fs, path: source, name: "old" })
yield* MCPConfigFile.remove({ fs, path: source, name: "remote" })
expect(parse(await Bun.file(source).text()).mcp).toBeUndefined()
```

同时覆盖损坏 JSONC、非法 MCP Schema 和不存在条目的显式失败。

- [ ] **Step 2: 运行测试确认 RED**

从 `packages/opencode` 运行：

```powershell
bun test test/mcp/config-file.test.ts
```

Expected: FAIL，提示 `@/mcp/config-file` 不存在。

- [ ] **Step 3: 实现文件编辑器**

文件顶部使用自导出：

```ts
export * as MCPConfigFile from "./config-file"
```

公开接口固定为：

```ts
export type Document = {
  readonly path: string
  readonly text: string
  readonly mcp: Readonly<Record<string, ConfigMCPV1.Info>>
}

export const read = Effect.fn("MCPConfigFile.read")(function* (input: {
  fs: FSUtil.Interface
  path: string
}) {
  const text = (yield* input.fs.readFileStringSafe(input.path)) ?? "{}"
  return yield* decodeDocument(input.path, text)
})

export const set = Effect.fn("MCPConfigFile.set")(function* (input: {
  fs: FSUtil.Interface
  path: string
  name: string
  config: ConfigMCPV1.Info
}) {
  const document = yield* read(input)
  const edits = modify(document.text, ["mcp", input.name], input.config, FORMATTING)
  yield* input.fs.writeWithDirs(input.path, applyEdits(document.text, edits))
})

export const remove = Effect.fn("MCPConfigFile.remove")(function* (input: {
  fs: FSUtil.Interface
  path: string
  name: string
}) {
  const document = yield* read(input)
  if (!(input.name in document.mcp)) return yield* new NotFoundError({ path: input.path, name: input.name })
  const text = applyEdits(document.text, modify(document.text, ["mcp", input.name], undefined, FORMATTING))
  const parsed = yield* decodeDocument(input.path, text)
  const next = Object.keys(parsed.mcp).length
    ? text
    : applyEdits(text, modify(text, ["mcp"], undefined, FORMATTING))
  yield* input.fs.writeWithDirs(input.path, next)
})
```

`decodeDocument`、`FORMATTING` 和文件级错误类定义在同一文件下方；`decodeDocument` 使用 `jsonc-parser.parse` 后逐项执行 `Schema.decodeUnknownEffect(ConfigMCPV1.Info)`。

所有解析/读写错误转换成带 `path` 和可读 `message` 的 `Schema.TaggedErrorClass`，保留原始 `cause: Schema.Defect`，不得返回空配置掩盖错误。

- [ ] **Step 4: 运行测试确认 GREEN**

```powershell
bun test test/mcp/config-file.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交文件编辑边界**

```powershell
git add packages/opencode/src/mcp/config-file.ts packages/opencode/test/mcp/config-file.test.ts
git commit -m "feat(opencode): add mcp config file editor"
```

---

### Task 2: 实现作用域、优先级和持久化 CRUD

**Files:**
- Create: `packages/opencode/src/mcp/config-source.ts`
- Create: `packages/opencode/src/mcp/config.ts`
- Create: `packages/opencode/test/mcp/config-source.test.ts`
- Create: `packages/opencode/test/mcp/config.test.ts`
- Modify: `packages/opencode/src/ne/mcp.ts`
- Modify: `packages/opencode/test/ne/mcp.test.ts`

**Interfaces:**
- Produces: `MCPConfigSource.discover(input)`、`encodeEntryID(input)`、`decodeEntryID(input)`。
- Consumes: `MCPConfigFile`、`MCPConfigSource`、`ConfigPaths`、`FSUtil.Interface`、`InstanceContext`。
- Produces: `MCPConfig.make({ fs, globalConfigDir })`。
- Produces: `MCPConfig.Entry` Schema 和 `list/create/update/remove`。
- Produces: `NeMcp.BUILTIN_MCP_NAMES`、`NeMcp.isBuiltinMcp(name)`。

- [ ] **Step 1: 编写来源、作用域和优先级失败测试**

`config-source.test.ts` 在一个临时根目录下创建独立的 `global` 和 `project` 目录，断言来源顺序、默认创建目标和 URL-safe 条目 ID 往返；篡改 ID 或把来源改到允许目录之外必须失败。

`config.test.ts` 构造真实 `InstanceContext`，至少覆盖：

```ts
expect((yield* manager.list(ctx)).filter((item) => item.readonly).map((item) => item.name)).toEqual([
  "noteexpress",
  "qingtibase",
])

yield* manager.create(ctx, {
  scope: "global",
  name: "shared",
  config: { type: "remote", url: "https://global.example/mcp" },
})
yield* manager.create(ctx, {
  scope: "project",
  name: "shared",
  config: { type: "local", command: ["npx", "-y", "@example/shared"] },
})

const rows = (yield* manager.list(ctx)).filter((item) => item.name === "shared")
expect(rows.map((item) => [item.scope, item.effective])).toEqual([
  ["global", false],
  ["project", true],
])
```

还要覆盖：

- 同作用域任一配置来源存在同名项时返回 409 Conflict；
- `noteexpress` / `qingtibase` 的新增、更新、重命名、移除均失败；
- 更新保持原作用域，允许在同一文件内重命名；
- 移除精确修改条目 ID 对应的来源文件；
- 篡改或过期条目 ID 返回 404；
- 项目默认创建 `<worktree>/opencode.json`，全局默认创建 `<global>/opencode.json`；
- 项目创建不会产生 `config.json`。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
bun test test/mcp/config-source.test.ts test/mcp/config.test.ts test/ne/mcp.test.ts
```

Expected: FAIL，因为 MCP 配置管理器和共享内置 ID 尚不存在。

- [ ] **Step 3: 提取内置 MCP 元数据**

在 `packages/opencode/src/ne/mcp.ts` 增加稳定导出：

```ts
export const BUILTIN_MCP_NAMES = ["noteexpress", "qingtibase"] as const

export function isBuiltinMcp(name: string) {
  return BUILTIN_MCP_NAMES.includes(name as (typeof BUILTIN_MCP_NAMES)[number])
}
```

`withNeDefaultMcp` 使用同一组常量，不再在其他运行时文件复制保留 ID。

- [ ] **Step 4: 定义配置管理契约**

`packages/opencode/src/mcp/config.ts` 顶部使用：

```ts
export * as MCPConfig from "./config"
```

Schema 和公开类型固定为：

```ts
export const Scope = Schema.Literal("project", "global")
export type Scope = Schema.Schema.Type<typeof Scope>

export const EntryScope = Schema.Union([Scope, Schema.Literal("builtin")])

export const Entry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  scope: EntryScope,
  config: ConfigMCPV1.Info,
  source: Schema.optional(Schema.String),
  effective: Schema.Boolean,
  readonly: Schema.Boolean,
  overriddenBy: Schema.optional(Scope),
}).annotate({ identifier: "McpConfigEntry" })
export type Entry = Schema.Schema.Type<typeof Entry>

export const CreateInput = Schema.Struct({
  scope: Scope,
  name: Schema.String,
  config: ConfigMCPV1.Info,
})
export type CreateInput = Schema.Schema.Type<typeof CreateInput>

export const UpdateInput = Schema.Struct({
  name: Schema.String,
  config: ConfigMCPV1.Info,
})
export type UpdateInput = Schema.Schema.Type<typeof UpdateInput>
```

管理器接口固定为：

```ts
import { MCPConfigSource, PersistenceError } from "./config-source"
export { PersistenceError } from "./config-source"

export class InvalidError extends Schema.TaggedErrorClass<InvalidError>()(
  "MCPConfigInvalidError",
  { message: Schema.String, field: Schema.optional(Schema.String) },
  { httpApiStatus: 400 },
) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "MCPConfigNotFoundError",
  { message: Schema.String, entryID: Schema.optional(Schema.String) },
  { httpApiStatus: 404 },
) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  "MCPConfigConflictError",
  { message: Schema.String, name: Schema.String, scope: Scope },
  { httpApiStatus: 409 },
) {}

export type Failure = InvalidError | NotFoundError | ConflictError | PersistenceError

export interface Interface {
  readonly list: (ctx: InstanceContext) => Effect.Effect<readonly Entry[], Failure>
  readonly create: (ctx: InstanceContext, input: CreateInput) => Effect.Effect<readonly Entry[], Failure>
  readonly update: (
    ctx: InstanceContext,
    entryID: string,
    input: UpdateInput,
  ) => Effect.Effect<readonly Entry[], Failure>
  readonly remove: (ctx: InstanceContext, entryID: string) => Effect.Effect<readonly Entry[], Failure>
}

export function make(input: { fs: FSUtil.Interface; globalConfigDir: string }): Interface
```

- [ ] **Step 5: 实现独立来源发现模块**

`packages/opencode/src/mcp/config-source.ts` 顶部使用：

```ts
export * as MCPConfigSource from "./config-source"
```

该文件只负责来源、优先级、默认目标和条目 ID，不解析或修改 JSONC。公开类型：

```ts
export type Source = {
  readonly scope: "project" | "global"
  readonly path: string
  readonly precedence: number
}

export class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()(
  "MCPConfigPersistenceError",
  { message: Schema.String, path: Schema.optional(Schema.String), cause: Schema.optional(Schema.Defect) },
  { httpApiStatus: 500 },
) {}

export function discover(input: {
  fs: FSUtil.Interface
  globalConfigDir: string
  ctx: InstanceContext
}): Effect.Effect<readonly Source[], PersistenceError>
```

条目 ID 使用 URL-safe Base64 编码 `scope + source + name`。`decodeEntryID` 只解码结构，管理器必须用本次 `discover` 的结果再次验证来源路径，禁止客户端借 ID 操作任意路径。

- [ ] **Step 6: 实现来源优先级和列表合并**

按真实配置加载顺序生成来源列表：

1. 全局：`config.json`、`opencode.json`、`opencode.jsonc`。
2. 项目根配置：`ConfigPaths.files("opencode", ctx.directory, ctx.worktree)`。
3. 当前工作树内发现的 `.opencode/opencode.json`、`.opencode/opencode.jsonc`。

只保留存在的文件；数组后面的来源优先级更高。更新/移除时重新发现来源并验证解码路径仍在允许集合中。

将所有全局项按顺序合并，再合并项目项；每个名称只有最后一个条目 `effective: true`。缺失的内置项通过 `withNeDefaultMcp` 生成 `scope: "builtin"` 的只读合成条目。手工写入保留 ID 时只显示对应来源条目，并强制 `readonly: true`。

- [ ] **Step 7: 实现 CRUD**

- `create`：先校验名称正则 `/^[a-z0-9][a-z0-9_-]*$/`、保留 ID 和同作用域重复项，再选择该作用域最高优先级文件。
- `update`：解析条目 ID，拒绝内置/保留项；如果重命名，先检查新名称冲突，再在同一 JSONC 文本中删除旧键并写入新键。
- `remove`：解析条目 ID，拒绝内置/保留项，只删除对应来源。
- 每次写入后重新从磁盘调用 `list`，不返回请求参数的乐观副本。
- `MCPConfigFile` 的 JSONC/Schema 错误映射为 `InvalidError`，文件系统读写错误映射为 `PersistenceError`；映射后仍保留安全的路径和 Cause。

错误类型使用 `Schema.TaggedErrorClass`：

```ts
InvalidError      // _tag: MCPConfigInvalidError，HTTP 400
NotFoundError     // _tag: MCPConfigNotFoundError，HTTP 404
ConflictError     // _tag: MCPConfigConflictError，HTTP 409
PersistenceError  // 从 config-source.ts 重新导出，_tag: MCPConfigPersistenceError，HTTP 500
```

每个错误包含可读 `message`；持久化错误额外包含 `path`，但不得包含 OAuth Client Secret。

- [ ] **Step 8: 运行测试确认 GREEN**

```powershell
bun test test/mcp/config-file.test.ts test/mcp/config-source.test.ts test/mcp/config.test.ts test/ne/mcp.test.ts
```

Expected: PASS。

- [ ] **Step 9: 提交配置管理器**

```powershell
git add packages/opencode/src/mcp/config-source.ts packages/opencode/src/mcp/config.ts packages/opencode/test/mcp/config-source.test.ts packages/opencode/test/mcp/config.test.ts packages/opencode/src/ne/mcp.ts packages/opencode/test/ne/mcp.test.ts
git commit -m "feat(opencode): persist scoped mcp configs"
```

---

### Task 3: 暴露持久化 MCP HttpApi 并在写入后刷新实例

**Files:**
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/mcp.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/handlers/mcp.ts`
- Modify: `packages/opencode/test/server/httpapi-mcp.test.ts`
- Modify: `packages/opencode/test/server/httpapi-mcp-oauth.test.ts`

**Interfaces:**
- Consumes: `MCPConfig.make`、`markInstanceForDisposal`。
- Produces: `mcp.configList`、`mcp.configCreate`、`mcp.configUpdate`、`mcp.configRemove`。
- Preserves: 现有 `POST /mcp` 的仅运行时语义。

- [ ] **Step 1: 编写 HTTP CRUD 失败测试**

扩展 `httpapi-mcp.test.ts`，通过真实 `HttpApiApp.webHandler()` 请求：

```ts
const created = yield* request(handler, "/mcp/config", tmp.directory, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    scope: "project",
    name: "demo",
    config: { type: "local", command: ["echo", "demo"], enabled: false },
  }),
})
expect(created.status).toBe(200)
expect(await Bun.file(path.join(tmp.directory, "opencode.json")).text()).toContain('"demo"')
```

从响应取出 `entryID`，继续测试 PUT 重命名、DELETE 移除、重复名 409、保留 ID 400、未知 ID 404，以及失败写入不会调用实例销毁标记。

保留现有测试，证明 `POST /mcp` 仍只影响运行时。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
bun test test/server/httpapi-mcp.test.ts test/server/httpapi-mcp-oauth.test.ts
```

Expected: FAIL，`/mcp/config` 返回 404，OAuth 测试的处理器也尚未实现新端点。

- [ ] **Step 3: 声明类型化路由**

在 `McpPaths` 增加：

```ts
config: "/mcp/config",
configEntry: "/mcp/config/:entryID",
```

在 MCP HttpApi Group 中增加：

```ts
HttpApiEndpoint.get("configList", McpPaths.config, {
  query: WorkspaceRoutingQuery,
  success: described(Schema.Array(MCPConfig.Entry), "Persistent MCP configuration entries"),
})

HttpApiEndpoint.post("configCreate", McpPaths.config, {
  query: WorkspaceRoutingQuery,
  payload: MCPConfig.CreateInput,
  success: described(Schema.Array(MCPConfig.Entry), "Persistent MCP configuration entries"),
  error: [
    MCPConfig.InvalidError,
    MCPConfig.ConflictError,
    MCPConfig.PersistenceError,
  ],
})
```

PUT 和 DELETE 使用 `params: { entryID: Schema.String }`，并声明对应的 400/404/409/500 错误。所有 OpenAPI 描述明确使用“persistent”，现有 `add` 描述改成“runtime-only and not persisted”。

- [ ] **Step 4: 实现处理器和实例刷新**

在 Group 初始化时一次性获取依赖：

```ts
const fs = yield* FSUtil.Service
const config = MCPConfig.make({ fs, globalConfigDir: Global.Path.config })
```

读取接口：

```ts
const configList = Effect.fn("McpHttpApi.configList")(function* () {
  return yield* config.list(yield* InstanceState.context)
})
```

写接口必须先完成磁盘操作和响应数据读取，再标记实例：

```ts
const configCreate = Effect.fn("McpHttpApi.configCreate")(function* (ctx) {
  const instance = yield* InstanceState.context
  const entries = yield* config.create(instance, ctx.payload)
  yield* markInstanceForDisposal(instance)
  return entries
})
```

`configUpdate` 和 `configRemove` 使用相同顺序。禁止在写入前标记实例，禁止失败后调用 `MCP.add`。

- [ ] **Step 5: 更新 OAuth 测试处理器**

`httpapi-mcp-oauth.test.ts` 的小型处理器必须显式实现新增的四个 Handler：

```ts
.handle("configList", () => Effect.die("unexpected MCP configList"))
.handle("configCreate", () => Effect.die("unexpected MCP configCreate"))
.handle("configUpdate", () => Effect.die("unexpected MCP configUpdate"))
.handle("configRemove", () => Effect.die("unexpected MCP configRemove"))
```

- [ ] **Step 6: 运行 HTTP 测试确认 GREEN**

```powershell
bun test test/server/httpapi-mcp.test.ts test/server/httpapi-mcp-oauth.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交 API**

```powershell
git add packages/opencode/src/server/routes/instance/httpapi/groups/mcp.ts packages/opencode/src/server/routes/instance/httpapi/handlers/mcp.ts packages/opencode/test/server/httpapi-mcp.test.ts packages/opencode/test/server/httpapi-mcp-oauth.test.ts
git commit -m "feat(opencode): expose persistent mcp config api"
```

---

### Task 4: 生成 SDK 并固定客户端请求契约

**Files:**
- Regenerate: `packages/sdk/openapi.json`
- Regenerate: `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- Regenerate: `packages/sdk/js/src/v2/gen/types.gen.ts`
- Create: `packages/app/src/components/settings-v2/mcp-client.test.ts`

**Interfaces:**
- Produces: `client.mcp.configList()`。
- Produces: `client.mcp.configCreate({ scope, name, config })`。
- Produces: `client.mcp.configUpdate({ entryID, name, config })`。
- Produces: `client.mcp.configRemove({ entryID })`。

- [ ] **Step 1: 重新生成 JavaScript SDK**

从仓库根目录运行：

```powershell
bun packages/sdk/js/script/build.ts
```

Expected: OpenAPI 和 v2 生成文件出现四个 MCP 配置方法及 Entry 类型。

- [ ] **Step 2: 编写生成客户端请求测试**

使用带记录能力的真实生成客户端和自定义 `fetch`，调用四个方法并断言：

```ts
await client.mcp.configCreate({
  scope: "project",
  name: "demo",
  config: { type: "local", command: ["echo", "demo"] },
})

expect(request.method).toBe("POST")
expect(new URL(request.url).pathname).toBe("/mcp/config")
expect(await request.json()).toEqual({
  scope: "project",
  name: "demo",
  config: { type: "local", command: ["echo", "demo"] },
})
```

PUT/DELETE 必须将 URL-safe `entryID` 写入路径，不能写入 Query 或 Body。

- [ ] **Step 3: 运行客户端测试**

从 `packages/app` 运行：

```powershell
bun test src/components/settings-v2/mcp-client.test.ts
```

Expected: PASS。

- [ ] **Step 4: 提交生成文件和契约测试**

```powershell
git add packages/sdk/openapi.json packages/sdk/js/src/v2/gen packages/app/src/components/settings-v2/mcp-client.test.ts
git commit -m "chore(sdk): generate persistent mcp client"
```

---

### Task 5: 建立桌面列表模型与纯表单校验

**Files:**
- Create: `packages/app/src/components/settings-v2/mcp-model.ts`
- Create: `packages/app/src/components/settings-v2/mcp-model.test.ts`
- Create: `packages/app/src/components/settings-v2/mcp-form.ts`
- Create: `packages/app/src/components/settings-v2/mcp-form.test.ts`
- Modify: `packages/app/src/components/ne-mcp.ts`
- Modify: `packages/app/src/components/ne-mcp.test.ts`

**Interfaces:**
- Consumes: 生成的 `McpConfigEntry`、`McpStatus`、`McpLocalConfig`、`McpRemoteConfig`。
- Produces: `mcpManagementRows(entries, statuses)`。
- Produces: `desktopMcpManagementEnabled(platform)`。
- Produces: `createMcpForm(entry?)`、`validateMcpForm(form, existingNames)`。

- [ ] **Step 1: 编写桌面列表模型失败测试**

覆盖：

```ts
expect(desktopMcpManagementEnabled("desktop")).toBe(true)
expect(desktopMcpManagementEnabled("web")).toBe(false)

expect(
  mcpManagementRows(entries, {
    noteexpress: { status: "connected" },
    qingtibase: { status: "disabled" },
    shared: { status: "disabled" },
  }).map((row) => [row.name, row.scope, row.canManage, row.canToggle]),
).toEqual([
  ["noteexpress", "builtin", false, true],
  ["qingtibase", "builtin", false, true],
  ["shared", "global", true, false],
  ["shared", "project", true, true],
])
```

断言被覆盖全局项没有连接控制，内置项排在最前面，状态错误原样保留。

- [ ] **Step 2: 编写表单校验失败测试**

至少覆盖：

- 名称大写、保留 ID、重复名称；
- 本地命令空参数和参数数组原样保留；
- 环境变量/Header 键按不区分大小写判重；
- HTTP/HTTPS URL 与 Redirect URI；
- Timeout 正整数、Callback Port 1..65535；
- OAuth 三态序列化；
- 编辑时名称不把自身判为重复。

三态断言：

```ts
expect(validate(remote({ oauthMode: "auto" })).result?.config).not.toHaveProperty("oauth")
expect(validate(remote({ oauthMode: "disabled" })).result?.config).toMatchObject({ oauth: false })
expect(validate(remote({ oauthMode: "explicit", clientId: "" })).result?.config).toMatchObject({ oauth: {} })
```

- [ ] **Step 3: 运行测试确认 RED**

```powershell
bun test src/components/settings-v2/mcp-model.test.ts src/components/settings-v2/mcp-form.test.ts src/components/ne-mcp.test.ts
```

Expected: FAIL，新模块和内置判断尚不存在。

- [ ] **Step 4: 实现列表模型**

`McpManagementRow` 固定包含：

```ts
export type McpManagementRow = {
  readonly id: string
  readonly name: string
  readonly displayName: string
  readonly scope: "builtin" | "project" | "global"
  readonly config: McpLocalConfig | McpRemoteConfig
  readonly status?: McpStatus["status"]
  readonly error?: string
  readonly overriddenBy?: "project" | "global"
  readonly canManage: boolean
  readonly canToggle: boolean
}
```

`desktopMcpManagementEnabled` 只接受平台名称并严格判断 `platform === "desktop"`。`canToggle` 仅在条目生效且存在对应运行状态时为真；查询切换期间状态缺失要显示加载状态，不能猜测为已禁用。非桌面调用方继续使用现有 `mcpDisplayItems(status)`，不得构造配置请求。

- [ ] **Step 5: 实现表单模型**

纯模块返回可交给 `createStore` 的单个状态对象；对话框不得为每个字段分别创建 `createSignal`。表单类型包含：

```ts
export type McpForm = {
  mode: "create" | "edit"
  originalName?: string
  scope: "project" | "global"
  name: string
  type: "local" | "remote"
  enabled: boolean
  timeout: string
  command: CommandRow[]
  cwd: string
  environment: KeyValueRow[]
  url: string
  headers: KeyValueRow[]
  oauthMode: "auto" | "disabled" | "explicit"
  clientId: string
  clientSecret: string
  oauthScope: string
  callbackPort: string
  redirectUri: string
  pendingType?: "local" | "remote"
}
```

校验成功返回：

```ts
{
  scope: form.scope,
  name,
  config: McpLocalConfig | McpRemoteConfig,
}
```

空的可选字段省略；`enabled` 明确保存布尔值；空键值行忽略，只有半填写或重复时报告行级错误。

- [ ] **Step 6: 运行测试确认 GREEN**

```powershell
bun test src/components/settings-v2/mcp-model.test.ts src/components/settings-v2/mcp-form.test.ts src/components/ne-mcp.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交纯模型**

```powershell
git add packages/app/src/components/settings-v2/mcp-model.ts packages/app/src/components/settings-v2/mcp-model.test.ts packages/app/src/components/settings-v2/mcp-form.ts packages/app/src/components/settings-v2/mcp-form.test.ts packages/app/src/components/ne-mcp.ts packages/app/src/components/ne-mcp.test.ts
git commit -m "feat(app): model desktop mcp management"
```

---

### Task 6: 实现 MCP 编辑与移除对话框

**Files:**
- Create: `packages/app/src/components/settings-v2/dialog-mcp.tsx`
- Create: `packages/app/src/components/settings-v2/mcp-key-value-editor.tsx`
- Create: `packages/app/src/components/settings-v2/mcp-local-fields.tsx`
- Create: `packages/app/src/components/settings-v2/mcp-remote-fields.tsx`
- Create: `packages/app/src/components/settings-v2/dialog-mcp-remove.tsx`
- Create: `packages/app/src/components/settings-v2/mcp-dialog-contract.test.ts`
- Modify: `packages/app/src/components/settings-v2/settings-v2.css`

**Interfaces:**
- Consumes: `createMcpForm`、`validateMcpForm`。
- Produces: `DialogMcp({ entry?, existingNames, onSubmit })`。
- Produces: `DialogMcpRemove({ entry, onConfirm })`。
- Produces: 可复用 `McpKeyValueEditor`。
- Produces: `McpLocalFields` 与 `McpRemoteFields`，让主对话框保持在 300 行以内。

- [ ] **Step 1: 编写对话框契约失败测试**

读取组件源文件并固定可访问契约：

```ts
expect(dialogSource).toContain('data-action="mcp-save"')
expect(dialogSource).toContain('data-action="mcp-command-add"')
expect(dialogSource).toContain('type="password"')
expect(removeSource).toContain('data-action="mcp-remove-confirm"')
expect(removeSource).toContain("props.entry.scope")
```

同时断言 `dialog-mcp.tsx`、`mcp-key-value-editor.tsx`、`mcp-local-fields.tsx`、`mcp-remote-fields.tsx`、`dialog-mcp-remove.tsx` 各自不超过 300 行。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
bun test src/components/settings-v2/mcp-dialog-contract.test.ts
```

Expected: FAIL，组件文件尚不存在。

- [ ] **Step 3: 实现键值与命令行编辑器**

`McpKeyValueEditor` 使用带稳定 Row ID 的 `For` 渲染，提供：

- 键输入；
- 值输入；
- 删除按钮和明确 `aria-label`；
- “添加”按钮；
- 行级错误。

`McpLocalFields` 组合命令参数、工作目录和环境变量；`McpRemoteFields` 组合 URL、Header 与 OAuth 字段。两个组件接收同一个 `McpForm` Store 和 `SetStoreFunction<McpForm>`，不得复制第二份状态。命令参数按独立行编辑，第一个参数是可执行命令，其余是参数，不得提供单个 Shell 字符串输入后自行切分。

- [ ] **Step 4: 实现新增/编辑对话框**

使用 `Dialog`、`DialogFooter`、`TextInputV2`、`SelectV2`、`Switch`。新增时作用域可选，编辑时展示只读作用域标签。

类型切换必须先进入显式确认状态，不能立即丢弃已填写字段：

```ts
const selectType = (type: "local" | "remote") => {
  if (type === form.type) return
  setForm("pendingType", type)
}

const confirmType = () => {
  if (!form.pendingType) return
  setForm(replaceTypeFields(form, form.pendingType))
}
```

对话框内显示“切换类型将清除当前类型字段”的确认区，提供“取消切换”和“继续切换”。`replaceTypeFields` 是 `mcp-form.ts` 的纯函数，负责清空旧类型专属字段。提交顺序：

1. 调用 `validateMcpForm`；
2. 把字段错误写回 Store；
3. 校验成功后 Await `props.onSubmit`；
4. 仅成功时 `dialog.close()`；
5. 失败时保留对话框，错误由调用方 Toast 显示。

- [ ] **Step 5: 实现移除确认对话框**

确认文案同时显示 MCP 名称和“当前项目/全局”作用域。确认按钮使用现有最强对比 `ButtonV2 variant="contrast"`；等待请求时禁用取消与确认。Promise 失败后保持对话框打开，不能本地移除列表项。

- [ ] **Step 6: 添加样式并控制文件规模**

新增样式类只放在 `settings-v2.css`：

- 对话框最大宽度；
- 双列字段布局；
- 键值行网格；
- 行级错误；
- 小屏幕单列折叠；
- 密钥字段不溢出。

不得在 TSX 中堆叠重复的长 Tailwind 字符串替代可复用类。

- [ ] **Step 7: 运行契约和表单测试**

```powershell
bun test src/components/settings-v2/mcp-dialog-contract.test.ts src/components/settings-v2/mcp-form.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交对话框**

```powershell
git add packages/app/src/components/settings-v2/dialog-mcp.tsx packages/app/src/components/settings-v2/mcp-key-value-editor.tsx packages/app/src/components/settings-v2/mcp-local-fields.tsx packages/app/src/components/settings-v2/mcp-remote-fields.tsx packages/app/src/components/settings-v2/dialog-mcp-remove.tsx packages/app/src/components/settings-v2/mcp-dialog-contract.test.ts packages/app/src/components/settings-v2/settings-v2.css
git commit -m "feat(app): add desktop mcp dialogs"
```

---

### Task 7: 接入桌面设置页、菜单、查询和翻译

**Files:**
- Modify: `packages/app/src/components/settings-v2/mcp.tsx`
- Create: `packages/app/src/components/settings-v2/mcp-row-menu.tsx`
- Create: `packages/app/src/components/settings-v2/mcp-desktop-contract.test.ts`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`
- Modify: `packages/app/src/components/settings-v2/settings-v2.css`

**Interfaces:**
- Consumes: 生成 SDK、`mcpManagementRows`、`DialogMcp`、`DialogMcpRemove`。
- Produces: 桌面专属“添加 MCP”、编辑、移除和作用域标签。
- Preserves: 非桌面现有状态、连接和 OAuth 行为。

- [ ] **Step 1: 编写桌面门控失败测试**

源契约测试必须固定：

```ts
expect(source).toContain('platform.platform === "desktop"')
expect(source).toContain('enabled: desktop() && !!directory()')
expect(source).toContain('data-action="mcp-add"')
expect(source).toContain("client.mcp.configList")
expect(source).toContain("DialogMcpRemove")
```

同时断言配置查询的 Query Key 包含 `serverSDK().scope`、目录和 `"mcp-config"`，非桌面分支继续调用 `mcpDisplayItems(status)`。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
bun test src/components/settings-v2/mcp-desktop-contract.test.ts
```

Expected: FAIL，设置页尚未接入桌面管理。

- [ ] **Step 3: 接入桌面配置查询**

在 `SettingsMcpV2` 中加入 `usePlatform()`：

```ts
const desktop = () => platform.platform === "desktop"
const config = useQuery(() => ({
  queryKey: [serverSDK().scope, directory(), "settings", "mcp-config"] as const,
  enabled: desktop() && !!directory(),
  queryFn: () => mcpClient(directory, serverSDK).mcp.configList().then((result) => result.data ?? []),
}))
```

行模型：

```ts
const items = createMemo(() =>
  desktop()
    ? mcpManagementRows(config.data ?? [], status.data ?? {})
    : mcpDisplayItems(status.data ?? {}),
)
```

非桌面环境不触发配置 Mutation，不请求 `/mcp/config`，并保持当前列表结构。

- [ ] **Step 4: 接入新增、编辑、移除 Mutation**

新增：

```ts
client.mcp.configCreate({ scope: payload.scope, name: payload.name, config: payload.config })
```

编辑：

```ts
client.mcp.configUpdate({
  entryID: entry.id,
  name: payload.name,
  config: payload.config,
})
```

移除：

```ts
client.mcp.configRemove({ entryID: entry.id })
```

三个 Mutation 成功后都同时：

```ts
await config.refetch()
await status.refetch()
```

失败统一使用现有 `showToast`，标题为 `common.requestFailed`，描述使用真实错误消息。禁止在失败时本地删除或修改行。

- [ ] **Step 5: 实现行菜单与状态控制**

`McpRowMenu` 使用 `MenuV2` 和 `IconButtonV2`：

```tsx
<Show when={props.entry.canManage}>
  <MenuV2.Item onSelect={() => props.onEdit(props.entry)}>
    {language.t("settings.mcp.action.edit")}
  </MenuV2.Item>
  <MenuV2.Separator />
  <MenuV2.Item onSelect={() => props.onRemove(props.entry)}>
    {language.t("settings.mcp.action.remove")}
  </MenuV2.Item>
</Show>
```

内置项没有菜单。被覆盖项显示“已被项目配置覆盖”标签，没有连接 Switch/OAuth 按钮。生效的内置和自定义项继续使用现有 `toggleMcp`。

- [ ] **Step 6: 添加桌面按钮和翻译**

标题区只在桌面显示：

```tsx
<Show when={desktop()}>
  <ButtonV2 data-action="mcp-add" variant="ghost-muted" icon="plus" onClick={openAdd}>
    {language.t("settings.mcp.action.add")}
  </ButtonV2>
</Show>
```

在 English、简体中文、繁体中文增加同一组键：

```ts
"settings.mcp.action.add"
"settings.mcp.action.edit"
"settings.mcp.action.remove"
"settings.mcp.scope.project"
"settings.mcp.scope.global"
"settings.mcp.scope.builtin"
"settings.mcp.overridden.project"
"settings.mcp.dialog.add.title"
"settings.mcp.dialog.edit.title"
"settings.mcp.dialog.remove.title"
"settings.mcp.dialog.remove.description"
"settings.mcp.type.label"
"settings.mcp.type.local"
"settings.mcp.type.remote"
"settings.mcp.field.name"
"settings.mcp.field.scope"
"settings.mcp.field.enabled"
"settings.mcp.field.timeout"
"settings.mcp.field.command"
"settings.mcp.field.cwd"
"settings.mcp.field.environment"
"settings.mcp.field.url"
"settings.mcp.field.headers"
"settings.mcp.field.oauthMode"
"settings.mcp.field.clientId"
"settings.mcp.field.clientSecret"
"settings.mcp.field.oauthScope"
"settings.mcp.field.callbackPort"
"settings.mcp.field.redirectUri"
"settings.mcp.oauth.auto"
"settings.mcp.oauth.disabled"
"settings.mcp.oauth.explicit"
"settings.mcp.row.add"
"settings.mcp.row.remove"
"settings.mcp.typeChange.title"
"settings.mcp.typeChange.description"
"settings.mcp.error.name.reserved"
"settings.mcp.error.name.duplicate"
"settings.mcp.error.name.format"
"settings.mcp.error.required"
"settings.mcp.error.duplicate"
"settings.mcp.error.url"
"settings.mcp.error.positiveInteger"
"settings.mcp.error.callbackPort"
```

所有用户可见标签都使用 NeCode，不出现 opencode 产品文案；配置文件名和 API 名称保持技术原名。

- [ ] **Step 7: 运行桌面设置聚焦测试**

```powershell
bun test src/components/settings-v2/mcp-desktop-contract.test.ts src/components/settings-v2/mcp-dialog-contract.test.ts src/components/settings-v2/mcp-model.test.ts src/components/settings-v2/mcp-form.test.ts src/components/ne-mcp.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交设置页接线**

```powershell
git add packages/app/src/components/settings-v2/mcp.tsx packages/app/src/components/settings-v2/mcp-row-menu.tsx packages/app/src/components/settings-v2/mcp-desktop-contract.test.ts packages/app/src/components/settings-v2/settings-v2.css packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/app/src/i18n/zht.ts
git commit -m "feat(desktop): manage custom mcp servers"
```

---

### Task 8: 完成自动化验证和构建

**Files:**
- Verify: 所有本计划修改文件。

**Interfaces:**
- Produces: 后端持久化、API、SDK、桌面模型和构建的最新验证证据。

- [ ] **Step 1: 运行组合后端测试**

从 `packages/opencode` 运行，执行器设置 60 秒超时：

```powershell
bun test test/mcp/config-file.test.ts test/mcp/config-source.test.ts test/mcp/config.test.ts test/ne/mcp.test.ts test/server/httpapi-mcp.test.ts test/server/httpapi-mcp-oauth.test.ts
```

Expected: 全部 PASS，0 failure。

- [ ] **Step 2: 运行组合前端测试**

从 `packages/app` 运行：

```powershell
bun test src/components/settings-v2/mcp-client.test.ts src/components/settings-v2/mcp-model.test.ts src/components/settings-v2/mcp-form.test.ts src/components/settings-v2/mcp-dialog-contract.test.ts src/components/settings-v2/mcp-desktop-contract.test.ts src/components/ne-mcp.test.ts
```

Expected: 全部 PASS，0 failure。

- [ ] **Step 3: 运行包级 Typecheck**

```powershell
cd D:\project\opencode\packages\opencode
bun typecheck
cd D:\project\opencode\packages\app
bun typecheck
```

Expected: 两个包均退出码 0。

- [ ] **Step 4: 验证生成文件和格式**

```powershell
cd D:\project\opencode
git diff --check
git status --short
```

Expected: 无空白错误；只出现本功能文件和用户原有未提交文件；SDK 没有遗漏的再次生成差异。

- [ ] **Step 5: 构建应用**

从 `packages/app` 运行：

```powershell
bun run build
```

Expected: Vite 生产构建退出码 0。

- [ ] **Step 6: 对照规格审查**

逐条核对 `docs/superpowers/specs/2026-07-10-custom-mcp-management-design.md`：

- 桌面端限定；
- 项目/全局作用域；
- 本地/远程/OAuth 全字段；
- JSONC 持久化；
- 内置项只读；
- 编辑/移除；
- 重名覆盖；
- 实例刷新；
- 显式错误；
- 非桌面不请求配置接口。

发现缺口立即修复并重跑相关测试，存在未覆盖要求时不得结束实施。

---

### Task 9: 在当前 NeCode DEV 中实机验证

**Files:**
- Verify: 桌面运行时与真实配置文件。

**Interfaces:**
- Produces: 当前 NeCode DEV 的可见验证结果和磁盘持久化证据。

- [ ] **Step 1: 用 Computer Use 验证桌面入口**

在当前已运行的 NeCode DEV 中打开“设置 → MCP”，确认：

1. 标题区出现“添加 MCP”；
2. NoteExpress 和 Qingti Base 排在前面；
3. 两个内置项没有编辑/移除菜单；
4. 连接和 OAuth 控制仍可用。

- [ ] **Step 2: 创建项目级本地 MCP**

创建一个不会执行危险操作的禁用测试项：

```text
名称: codex-project-test
作用域: 当前项目
类型: 本地命令
命令参数: node, -e, console.log("mcp-test")
启动时启用: 关闭
环境变量: MCP_TEST=project
```

保存后确认列表显示“当前项目”和“已禁用”。用 Shell 读取当前工作树选中的 `opencode.json/jsonc`，确认条目真实写盘且注释未丢失。

- [ ] **Step 3: 创建全局远程 MCP**

创建禁用测试项：

```text
名称: codex-global-test
作用域: 全局
类型: 远程 URL
URL: https://example.com/mcp
启动时启用: 关闭
Header: X-MCP-Test=global
OAuth: 禁用
```

确认全局配置文件包含 `oauth: false`、Header 和禁用状态。

- [ ] **Step 4: 验证编辑、覆盖和失败反馈**

1. 编辑项目项，添加 Timeout 和第二个环境变量，确认保存后文件更新；
2. 尝试创建 `noteexpress`，确认显示保留名称错误；
3. 在项目与全局创建同名禁用项，确认项目项可控制，全局项显示“已被项目配置覆盖”；
4. 输入非法 URL、重复 Header 和非法回调端口，确认对话框阻止提交并定位字段；
5. 提交服务端会拒绝的保留名称或重复名称，确认真实 API 错误通过 Toast 显示，且列表不产生假条目。磁盘不可写错误由自动化测试覆盖，实机验证不修改用户配置文件权限。

- [ ] **Step 5: 验证移除**

移除对话框必须显示名称和作用域。先取消确认列表不变，再确认移除两个测试项；读取项目和全局文件，确认只删除对应 `mcp.<name>`，无关配置和注释仍在。

- [ ] **Step 6: 验证重新加载后的持久状态**

由于 `packages/app/AGENTS.md` 禁止代理主动重启应用或服务：

1. 先通过关闭并重新打开 MCP 设置页、切换项目再切回，确认实例销毁后配置从磁盘重新加载；
2. 自动化测试必须覆盖“新实例从磁盘读取”的路径；
3. 如果必须验证完整进程重启，由用户手动退出并重新打开 NeCode；用户完成后再用 Computer Use 确认测试项仍存在。

- [ ] **Step 7: 清理测试配置并复核最终状态**

删除所有 `codex-*-test` 条目，确认 NoteExpress 和 Qingti Base 保持原状态，工作区没有残留测试 MCP 配置。如果测试前目标文件不存在，并且清理后新文件只剩空对象，则仅在确认绝对路径位于当前工作树或全局配置目录后删除该新文件。重新运行 `git diff --check`，并报告真实验证结果；任何未验证项必须明确列出。
