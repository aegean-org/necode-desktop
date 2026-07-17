# NeCode Computer Use MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过外部安装的 `cua-driver mcp` 为 NeCode Desktop 提供按会话激活、可随时退出的 Windows 11/macOS Computer Use 能力，并迁移 Desktop 配置目录。

**Architecture:** NeCode 内置一个可停用的 `builtin:computer-use` 插件，插件只负责跨平台发现 Cua Driver 并注入绝对路径 MCP 配置，不分发 Driver 或 Skill Pack。Session metadata 保存 `computerUse.enabled`；模型工具装配阶段只给已激活会话注入裁剪后的 `cua-driver_*` 工具，并将 Cua 的 `session` 参数绑定为当前 NeCode Session ID。Desktop UI 通过 `@电脑` 激活模式，通过持久状态项执行“退出”或“停止并退出”。

**Tech Stack:** Bun、TypeScript、Effect、MCP SDK、SolidJS、Electron、生成式 JavaScript SDK。

## Global Constraints

- 只使用外部安装的 `cua-driver mcp`，不得把 Cua Driver 二进制加入 NeCode 安装包。
- 不安装、不启用、不依赖 Cua Driver Skill Pack，也不新增 NeCode Computer Use Skill。
- 首期平台为 Windows 11 与 macOS；Linux 返回明确的不支持状态。
- Windows 查找顺序：`PATH`，然后 `%LOCALAPPDATA%\Programs\Cua\cua-driver\bin\cua-driver.exe`。
- macOS 查找顺序：`PATH`、`~/.local/bin/cua-driver`、`/usr/local/bin/cua-driver`、`/opt/homebrew/bin/cua-driver`。
- macOS 使用 Driver daemon/proxy 与 `permissions status --json`，不得使用 `--embedded`。
- 内置插件键为 `builtin:computer-use`，MCP 名为 `cua-driver`；用户自定义同名 MCP 时不得覆盖。
- `@电脑` 是会话能力开关，不得编码为 AgentPart、FilePart、RAG Part 或 Skill。
- 默认会话不承担 Cua 工具上下文；仅 `metadata.computerUse.enabled === true` 的会话注入允许列表。
- 用户退出后必须从后续模型请求移除 Cua 工具；Driver 清理失败也要关闭 NeCode 侧模式并显示真实错误。
- Desktop 配置目录仅迁移 `xdg-config/opencode` 到 `xdg-config/necode-desktop`，不改名 data/cache/state 目录。

---

### Task 1: Desktop 配置目录迁移

**Files:**
- Create: `packages/desktop/src/main/config-dir.ts`
- Modify: `packages/desktop/src/main/sidecar-env.ts`
- Modify: `packages/desktop/src/main/server.ts`
- Modify: `packages/desktop/src/main/sidecar.ts`
- Modify: `packages/desktop/src/main/index.ts`
- Test: `packages/desktop/config-dir.test.ts`
- Test: `packages/desktop/sidecar-env.test.ts`

**Interfaces:**
- Produces: `migrateDesktopConfigDir(input: { userDataPath: string; log?: (...) => void }): string`，返回本次启动实际使用的 config 目录名。
- Produces: `createDesktopRuntimeEnv(input: { userDataPath: string; password?: string; configDir?: string })`，允许启动迁移失败时继续使用旧目录。

- [ ] **Step 1: 写迁移失败测试**

  在临时目录覆盖五种行为：无旧目录使用 `necode-desktop`；仅旧目录时整体移动；新旧同时存在时保留新目录；重命名失败后复制并原子落位；迁移彻底失败时返回旧目录且保留旧文件。`sidecar-env.test.ts` 先断言默认路径为 `xdg-config/necode-desktop`，并断言传入 `configDir: "opencode"` 时使用旧目录。

- [ ] **Step 2: 运行测试并确认 RED**

  Run: `bun test config-dir.test.ts sidecar-env.test.ts`（工作目录 `packages/desktop`）

  Expected: 因 `migrateDesktopConfigDir` 不存在、默认目录仍为 `opencode` 而失败。

- [ ] **Step 3: 实现最小迁移逻辑**

  `config-dir.ts` 使用同一文件系统完成 `rename`；失败时复制到 `<new>.migrating-<uuid>`，确认临时目录存在后将其重命名为新目录。任一阶段失败时记录原始错误并返回 `opencode`，不删除旧目录。`index.ts` 在 `preferAppEnv(...)` 前调用迁移函数，并把返回目录传给 Desktop sidecar 环境。

- [ ] **Step 4: 运行测试并确认 GREEN**

  Run: `bun test config-dir.test.ts sidecar-env.test.ts`（工作目录 `packages/desktop`）

  Expected: 所有迁移与环境测试通过。

- [ ] **Step 5: 提交**

  `git commit -m "fix(desktop): migrate config directory"`

### Task 2: Cua Driver 发现与内置插件

**Files:**
- Create: `packages/opencode/src/ne/computer-use.ts`
- Create: `packages/opencode/src/plugin/computer-use.ts`
- Modify: `packages/opencode/src/plugin/builtin.ts`
- Test: `packages/opencode/test/ne/computer-use.test.ts`
- Test: `packages/opencode/test/plugin/computer-use.test.ts`
- Modify Test: `packages/opencode/test/mcp/config.test.ts`

**Interfaces:**
- Produces: `ComputerUse.detect(input?) => Promise<ComputerUse.Status>`，状态为 `unsupported | not_installed | needs_permissions | ready | failed`，并携带绝对路径、版本或真实错误。
- Produces: `ComputerUsePlugin`，其 `config` hook 在未配置 `mcp["cua-driver"]` 时注入 `{ type: "local", command: [path, "mcp"], enabled: true, timeout: 30000 }`。

- [ ] **Step 1: 写 Driver 发现与插件失败测试**

  使用临时可执行文件和注入式命令执行器覆盖 Windows/macOS 查找顺序、Linux 不支持、未安装、版本命令失败、macOS 权限不足、用户自定义 MCP 不覆盖、未安装时插件 config hook 抛出真实错误、禁用插件不初始化。

- [ ] **Step 2: 运行测试并确认 RED**

  Run: `bun test test/ne/computer-use.test.ts test/plugin/computer-use.test.ts test/mcp/config.test.ts`（工作目录 `packages/opencode`）

  Expected: 因 Computer Use 模块、插件和保留名尚不存在而失败。

- [ ] **Step 3: 实现发现模块与插件**

  扫描 PATH 和平台默认目录，运行 `<driver> --version`；macOS 再运行 `<driver> permissions status --json` 并只读取结果。插件失败时把平台、路径、退出码和 stderr 保留在错误信息中；成功时仅注入绝对路径 `mcp` 命令，不执行下载、更新、授权或 Skill 操作。

- [ ] **Step 4: 运行测试并确认 GREEN**

  Run: `bun test test/ne/computer-use.test.ts test/plugin/computer-use.test.ts test/mcp/config.test.ts test/plugin/productivity-builtins.test.ts`（工作目录 `packages/opencode`）

  Expected: Computer Use 插件可管理，原有生产力插件行为不变。

- [ ] **Step 5: 提交**

  `git commit -m "feat(plugin): add computer use MCP"`

### Task 3: 按会话裁剪 Cua 工具并绑定 Session ID

**Files:**
- Create: `packages/opencode/src/session/computer-use.ts`
- Modify: `packages/opencode/src/session/tools.ts`
- Modify: `packages/opencode/src/mcp/index.ts`
- Modify: `packages/opencode/src/mcp/catalog.ts`
- Test: `packages/opencode/test/session/computer-use.test.ts`
- Test: `packages/opencode/test/mcp/catalog.test.ts`

**Interfaces:**
- Produces: `SessionComputerUse.enabled(session)`。
- Produces: `SessionComputerUse.allowedTool(key)`，仅允许规格中的 `cua_driver_*` 工具。
- Produces: `SessionComputerUse.bindSchema(schema)` 与 `bindArguments(args, sessionID)`，从模型 schema 移除 `session` 参数并在执行前绑定当前 Session ID。
- Produces: `MCP.Interface.callTool(clientName, toolName, args)`，供显式退出清理调用。

- [ ] **Step 1: 写工具裁剪与参数绑定测试**

  覆盖未激活会话无 Cua 工具、激活会话仅有允许列表、其他 MCP 不受影响、退出后的 metadata 不再开放工具、含 `session` 字段的 schema 对模型隐藏该字段、执行参数自动注入当前 Session ID、模型尝试覆盖 Session ID 时拒绝。

- [ ] **Step 2: 运行测试并确认 RED**

  Run: `bun test test/session/computer-use.test.ts test/mcp/catalog.test.ts`（工作目录 `packages/opencode`）

  Expected: 因会话裁剪和 direct MCP call 尚不存在而失败。

- [ ] **Step 3: 实现最小工具边界**

  `SessionTools.resolve` 在注册 MCP 工具前按 session metadata 过滤；只对内置名称前缀 `cua_driver_` 应用白名单和 Session 参数处理。`MCP.callTool` 使用现有客户端、缓存超时与 MCP `CallToolResultSchema`，保留 `isError` 文本并向上抛出。

- [ ] **Step 4: 运行测试并确认 GREEN**

  Run: `bun test test/session/computer-use.test.ts test/mcp/catalog.test.ts test/session/tools.test.ts`（工作目录 `packages/opencode`，若 `tools.test.ts` 不存在则运行前两项）

  Expected: 会话边界测试通过，普通工具与普通 MCP 行为不变。

- [ ] **Step 5: 提交**

  `git commit -m "feat(session): scope computer use tools"`

### Task 4: Computer Use Session API 与 SDK

**Files:**
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/session.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts`
- Test: `packages/opencode/test/server/httpapi-session.test.ts`
- Generated: `packages/sdk/js/src/v2/gen/types.gen.ts`
- Generated: `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- Generated: `packages/sdk/js/src/v2/gen/client.gen.ts`

**Interfaces:**
- Produces: `POST /session/:sessionID/computer-use`，payload `{ enabled: boolean }`，response `{ enabled: boolean; error?: string }`。
- Produces: SDK `client.session.computerUse({ sessionID, enabled })`。

- [ ] **Step 1: 写 API RED 测试**

  覆盖：连接就绪时激活并合并原 metadata；连接不可用时不激活且返回真实错误；退出时先调用 `end_session` 并绑定 Session ID；清理失败时仍写入 `enabled: false` 且 response 返回错误；无关 metadata 保留。

- [ ] **Step 2: 运行测试并确认 RED**

  Run: `bun test test/server/httpapi-session.test.ts`（工作目录 `packages/opencode`）

  Expected: 因 endpoint 和 handler 不存在而失败。

- [ ] **Step 3: 实现 endpoint 与 handler**

  激活时检查 `mcp.status()["cua-driver"]` 必须为 `connected`，然后合并 metadata。退出时调用 `mcp.callTool("cua-driver", "end_session", { session: sessionID })`；无论调用结果如何都将 Computer Use 设为 false，并把清理错误放入响应与服务日志。

- [ ] **Step 4: 生成 SDK 并运行 GREEN 测试**

  Run: `./packages/sdk/js/script/build.ts`（仓库根目录）

  Run: `bun test test/server/httpapi-session.test.ts`（工作目录 `packages/opencode`）

  Expected: endpoint、OpenAPI schema 和生成 SDK 一致，测试通过。

- [ ] **Step 5: 提交**

  `git commit -m "feat(opencode): add computer use session API"`

### Task 5: `@电脑` 激活、状态项与退出交互

**Files:**
- Modify: `packages/app/src/components/prompt-input/slash-popover.tsx`
- Modify: `packages/app/src/components/prompt-input.tsx`
- Modify: `packages/app/src/components/prompt-input/submit.ts`
- Modify: `packages/app/src/components/prompt-input/slash-popover.test.tsx`
- Modify: `packages/app/src/components/prompt-input/submit.test.ts`
- Create: `packages/app/src/components/prompt-input/computer-use.tsx`
- Create: `packages/app/src/components/prompt-input/computer-use.test.ts`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`

**Interfaces:**
- Extends: `AtOption` 新增 `{ type: "capability"; id: "computer-use"; display; entry }`。
- Extends: `createPromptSubmit` 输入新增 `computerUse: () => boolean`，新会话创建时传递 metadata。
- Produces: `ComputerUseStatus`，显示已开启状态及“退出 Computer Use”/“停止并退出”。

- [ ] **Step 1: 写 UI 纯逻辑与 submit RED 测试**

  覆盖能力项描述与分组、插件 active/failed/disabled 显示、新会话 create payload 包含 metadata、普通新会话不含 metadata、退出标签随 working 状态变化、退出 cleanup error 显示真实 toast 文案。

- [ ] **Step 2: 运行测试并确认 RED**

  Run: `bun test src/components/prompt-input/slash-popover.test.tsx src/components/prompt-input/submit.test.ts src/components/prompt-input/computer-use.test.ts`（工作目录 `packages/app`）

  Expected: 因 capability 类型、draft 状态和状态组件不存在而失败。

- [ ] **Step 3: 实现激活与退出交互**

  `@` 列表读取 `builtin:computer-use` 插件状态。active 时选择后移除查询文本并激活：已有会话调用 Session API，新会话只设置 draft 状态；不可用时打开插件详情。状态项同时渲染于新旧 composer 布局；退出运行中会话时先调用现有 `abort()`，再调用 Computer Use API，失败响应显示 error toast，但本地/服务端 metadata 都以关闭为准。

- [ ] **Step 4: 运行测试并确认 GREEN**

  Run: `bun test src/components/prompt-input/slash-popover.test.tsx src/components/prompt-input/submit.test.ts src/components/prompt-input/computer-use.test.ts src/components/prompt-input/prompt-pill.test.ts src/components/prompt-input/build-request-parts.test.ts`（工作目录 `packages/app`）

  Expected: `@电脑` 不产生 Agent/File/RAG part，激活/退出行为和原有 prompt 构建测试通过。

- [ ] **Step 5: 提交**

  `git commit -m "feat(app): add computer use mode"`

### Task 6: 定向验证与平台验收记录

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-computer-use-mcp-design.md`（仅补充实际验收结果与已知限制）

**Interfaces:**
- Consumes: 前五个任务的 Desktop、OpenCode、SDK 和 App 改动。
- Produces: 可复现的 Windows 验收证据与明确的 macOS 未实机验证记录。

- [ ] **Step 1: 运行全部定向测试**

  Desktop: `bun test config-dir.test.ts sidecar-env.test.ts`（`packages/desktop`）

  OpenCode: `bun test test/ne/computer-use.test.ts test/plugin/computer-use.test.ts test/session/computer-use.test.ts test/server/httpapi-session.test.ts test/mcp/config.test.ts test/plugin/productivity-builtins.test.ts`（`packages/opencode`）

  App: `bun test src/components/prompt-input/slash-popover.test.tsx src/components/prompt-input/submit.test.ts src/components/prompt-input/computer-use.test.ts src/components/prompt-input/prompt-pill.test.ts src/components/prompt-input/build-request-parts.test.ts`（`packages/app`）

- [ ] **Step 2: 运行受影响 package typecheck**

  Run: `bun typecheck`（分别在 `packages/desktop`、`packages/opencode`、`packages/app`、`packages/sdk/js`）

  Expected: 四个 package 均退出 0。

- [ ] **Step 3: Windows 实机验收**

  使用已安装的 Cua Driver 0.8.1 验证：插件 active；`@电脑` 激活；Notepad `launch_app → get_window_state → type_text → get_window_state`；退出后下一轮不再出现 `cua-driver_*` 工具；Driver 进程/配置未被打包或自动安装。

- [ ] **Step 4: macOS 静态与实机边界**

  静态确认路径顺序、权限命令和未使用 `--embedded`。若当前无 macOS 机器，在规格验收记录中明确写入“未实机验证”，不得宣称 macOS 完成验收。

- [ ] **Step 5: 检查 diff 并提交**

  Run: `git status --short`、`git diff --check`、`git diff --stat dev...computer-use`

  Commit: `git commit -m "test(desktop): verify computer use mode"`（仅在存在验收文档或测试补充时）。
