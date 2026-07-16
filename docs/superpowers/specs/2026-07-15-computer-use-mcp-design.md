# NeCode Computer Use MCP 设计

## 1. 背景

NeCode 已验证可以通过 Cua Driver 的 stdio MCP 完成 Windows 桌面操作闭环：模型能够枚举窗口、读取 UI Automation 控件树和窗口截图、后台输入中英文文本，并在操作后重新获取窗口状态验证结果。

首期不把 Cua Driver 二进制打入 NeCode 安装包。NeCode 只提供内置产品入口和 MCP 适配，用户独立安装 Cua Driver。这样不会扩大当前桌面安装包，也能让 Driver 独立升级、卸载和修复。

Windows 11 与 macOS 同时进入首期支持范围。macOS 需要额外处理 GUI 应用 PATH、Accessibility、Screen Recording 和 Cua Driver daemon 身份；Linux 暂不进入首期验收。

## 2. 已确认决策

- 底层统一使用 `cua-driver mcp`，不实现 NeCode 私有桌面控制协议。
- 不随 NeCode 安装包分发 Cua Driver 二进制。
- 不自动下载安装或静默更新第三方二进制。
- 不安装、启用或依赖 Cua Driver Skill Pack。
- 不新增 NeCode Computer Use Skill；依赖 Cua MCP 自带的工具描述和 NeCode 现有模型工具循环。
- Windows 11 与 macOS 为首期支持平台，Linux 显示为暂不支持。
- 产品名称显示为“电脑 / Computer Use”，底层 MCP 名称保持 `cua-driver`。
- Computer Use 默认不向所有会话注入；用户通过输入框 `@电脑` 显式激活当前会话。
- `@电脑` 是会话能力开关，不是 Agent、文件附件或 Skill。
- 激活状态跨当前会话的后续轮次保持，用户可以随时退出或停止并退出。
- 首期复用 NeCode 现有工具权限机制，不宣称已经具备 Codex Desktop 的应用级授权能力。
- Desktop 配置目录从 `xdg-config/opencode` 迁移为 `xdg-config/necode-desktop`，保留旧目录兼容迁移。

## 3. 目标

1. 用户安装 Cua Driver 后，NeCode Desktop 能自动发现并连接其 MCP Server。
2. 用户未安装 Driver、macOS 权限不足或 MCP 连接失败时，界面显示真实状态和可执行的恢复指引。
3. NeCode 不因 Computer Use 增加桌面安装包体积。
4. 模型只接收首期需要的常用 Computer Use 工具，减少工具上下文和误调用。
5. Windows 与 macOS 使用同一套 MCP 会话、图片附件和模型工具执行链路。
6. 现有用户升级后保留插件、MCP、Skills 与其他全局配置。
7. Computer Use 只在用户显式激活的会话中占用模型工具上下文。
8. 激活后的会话可以组合桌面操作、Shell、日志和代码编辑工具完成真实应用调试。

## 4. 非目标

- 不复制或重新实现 Cua Driver 的 UI Automation、Windows Graphics Capture、macOS AX 或输入注入能力。
- 不将 Cua Driver 源码纳入 NeCode monorepo。
- 不在首期实现 Cua Driver 自动下载、自动升级或卸载。
- 不在首期实现完整应用白名单、密码字段识别、支付确认等 Codex Desktop 专有安全体验。
- 不保证所有第三方桌面软件都支持后台输入；Driver 返回 `background_unavailable` 时必须保留真实错误。
- 不为 Linux 提供首期产品入口或验收承诺。
- 不修改 OpenCode Core 的 `.opencode` 项目目录和 `opencode.jsonc` 文件名。

## 5. 总体架构

```text
设置 > 插件 > Computer Use
        │
        ▼
ComputerUse 运行时探测
  ├─ 平台支持
  ├─ Driver 可执行文件
  ├─ 版本与 doctor
  └─ macOS 权限状态
        │
        ▼
内置 Computer Use 插件
        │ config hook
        ▼
config.mcp["cua-driver"]
        │ stdio
        ▼
cua-driver mcp
        │
        ├─ UIA / AX 控件树
        ├─ 窗口截图
        ├─ 后台输入
        └─ 操作后状态
        │
        ▼
现有 MCP 图片附件与模型工具循环

输入框 @电脑
        │
        ▼
Session metadata: computerUse.enabled = true
        │
        ▼
当前会话注入裁剪后的 cua-driver 工具
```

NeCode 的内置插件只负责发现、配置和展示。桌面操作仍由外部 Cua Driver 进程完成，MCP 图片继续复用 `packages/opencode/src/session/tools.ts` 的附件转换链路。Cua MCP 可以保持连接，但只有 `computerUse.enabled === true` 的会话才能在模型请求中看到相关工具。

## 6. Driver 发现

新增单一的 Computer Use 运行时模块，返回平台、路径、版本、健康状态和恢复提示。调用方不得自行拼接第二套路径规则。

### 6.1 Windows

按以下顺序查找：

1. `PATH` 中的 `cua-driver.exe`。
2. `%LOCALAPPDATA%\Programs\Cua\cua-driver\bin\cua-driver.exe`。

官方 Windows 安装器默认使用第二个位置。配置 MCP 时写入发现到的绝对路径，避免 Desktop 在安装后仍持有旧 PATH。

### 6.2 macOS

按以下顺序查找：

1. `PATH` 中的 `cua-driver`。
2. `$HOME/.local/bin/cua-driver`。
3. `/usr/local/bin/cua-driver`。
4. `/opt/homebrew/bin/cua-driver`。

官方安装器默认使用 `$HOME/.local/bin`。macOS GUI 应用不能假定继承交互式 shell PATH，因此 MCP 配置同样写入绝对路径。

### 6.3 状态

运行时状态使用明确枚举：

- `unsupported`：非 Windows/macOS。
- `not_installed`：未找到可执行文件。
- `needs_permissions`：macOS Accessibility 或 Screen Recording 未授权。
- `ready`：Driver 与系统能力正常，但 MCP 尚未连接。
- `connected`：MCP 已连接。
- `failed`：可执行文件存在，但版本、诊断或 MCP 初始化失败。

不返回假的默认版本或成功状态。诊断命令失败时保留退出码和 stderr。

## 7. 内置插件与 MCP 配置

新增 `builtin:computer-use` 插件，显示名称为 `Computer Use`，允许用户启用和停用。该插件不包含 Cua Skill Pack，也不注册新的 NeCode Tool。

插件启用时：

1. 调用统一 Driver 发现模块。
2. 未安装或平台不支持时进入真实 `failed` 状态，并提供安装或平台说明。
3. macOS 权限不足时进入 `failed` 状态，提示运行 `cua-driver permissions grant`。
4. 可用时向运行时配置加入：

```json
{
  "mcp": {
    "cua-driver": {
      "type": "local",
      "command": ["<absolute-cua-driver-path>", "mcp"],
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

已存在用户自定义 `mcp.cua-driver` 时保留用户配置，不覆盖命令、环境变量或超时。内置插件停用后不再向运行时注入默认 Cua MCP，但不删除用户手写配置。

## 8. 工具裁剪

Cua Driver 0.8.1 的 `mcp` 命令没有服务端工具白名单参数。NeCode 在 MCP 工具注册阶段仅对内置默认的 `cua-driver` 应用允许列表，不创建代理进程。

首期默认开放：

- `list_apps`
- `list_windows`
- `get_window_state`
- `launch_app`
- `bring_to_front`
- `click`
- `double_click`
- `right_click`
- `drag`
- `type_text`
- `press_key`
- `hotkey`
- `set_value`
- `scroll`
- `check_permissions`
- `health_report`
- `start_session`
- `end_session`

首期默认隐藏录屏、轨迹回放、Driver 配置修改、更新、FFmpeg 安装、调试窗口信息和光标外观配置等工具。用户手写并使用其他 MCP 名称连接 Cua Driver 时不应用该产品裁剪，保留标准 MCP 行为。

工具注入还必须满足会话条件：

- 未激活 Computer Use 的会话不注入任何 `cua-driver_*` 工具。
- 激活会话只注入上述允许列表。
- 退出后，下一次模型请求不再包含 Cua 工具。
- 普通 Shell、文件、代码编辑、LSP 和其他 MCP 工具不受 Computer Use 模式影响。
- 向包含 `session` 参数的 Cua 工具自动注入当前 NeCode Session ID，模型显式传入其他值时拒绝覆盖会话边界。

## 9. `@电脑` 激活与退出

### 9.1 激活

输入框 `@` 菜单新增“能力”分组，并提供“电脑 / Computer Use”条目。它不复用 AgentPart，避免触发 Task 子代理语义；也不新增 Skill。

选择 `@电脑` 后：

1. 移除输入中的 `@电脑` 查询文本。
2. 如果内置 Computer Use 插件处于停用状态，通过现有插件配置接口自动启用，并等待运行时重载完成。
3. 检查 `cua-driver` MCP 状态；只有连接成功后才激活会话能力。
4. 在输入框上下文区域显示持久状态项“Computer Use 已开启”。
5. 新会话在创建时写入 `metadata.computerUse.enabled = true`。
6. 已存在会话通过现有 Session metadata 更新接口持久化状态。
7. 本次及后续轮次按允许列表注入 Cua 工具。

`@电脑` 是用户主动启用 Computer Use 的明确授权，不再要求用户预先进入插件设置打开开关。如果插件启用、Driver 发现、macOS 权限或 MCP 连接失败，输入区显示真实错误和恢复指引，不打开只读插件详情，不写入会话已启用状态，也不伪造成功。插件配置已经成功启用时保留启用状态，便于用户修复 Driver 后直接重试。

### 9.2 退出

输入框状态项提供明确退出操作：

- 空闲时显示“退出 Computer Use”。
- 正在执行时显示“停止并退出”。

退出流程：

1. 若当前 Session 正在运行，先调用现有 Session interrupt。
2. 使用当前 NeCode Session ID 结束 Cua Driver session，清理 Agent Cursor 和会话状态。
3. 将 `metadata.computerUse.enabled` 更新为 `false`。
4. 从下一次模型请求中移除全部 Cua 工具。
5. 保留普通聊天、Shell、代码和文件能力，用户无需新建会话。

中断或结束 Cua Session 失败时仍然关闭 NeCode 侧模式，但必须显示真实清理错误，不能显示伪成功。

### 9.3 展示

会话标题区域或输入框附近持续显示 Computer Use 状态，避免用户忘记当前会话拥有桌面控制能力。历史消息中的工具调用保持可见；退出不会删除执行记录。

### 9.4 Codex Desktop 交互参考

NeCode 参考 Codex Desktop 的用户交互原则，不复制其专有运行时：

- Computer Use 作为明确的“电脑”能力出现在输入区能力菜单，而不是要求用户理解 MCP 配置。
- 选中后在输入区显示可移除的能力状态，用户始终知道当前会话已获得桌面控制权限。
- 执行过程中保留清晰的工具时间线，显示目标应用、操作类型、成功或原始错误。
- 截图和窗口状态属于工具执行结果，不伪装成普通文字回答。
- 运行时始终保留可见的停止入口。
- 需要用户授权或高风险确认时暂停执行，确认后继续同一任务。
- 工具失败后允许模型基于新窗口状态恢复，但失败记录保持红色或错误状态，不改写历史结果。
- 退出 Computer Use 不结束聊天，也不移除代码、Shell、文件和其他生产力能力。

NeCode 保留自身视觉和组件规范，不逐像素复制 Codex Desktop；目标是复用清晰的激活、状态、确认、停止和退出模型。

## 10. 模型执行与应用调试

不新增 Skill。主要约束来自 Cua Driver 的工具描述：

- 操作目标必须来自 `list_windows` 或 `launch_app` 返回的 `pid + window_id`。
- element action 前必须对同一窗口调用 `get_window_state`。
- 默认先使用后台输入；仅在 Driver 明确返回 `background_unavailable` 后才允许前台升级。
- 修改操作后再次调用 `get_window_state` 验证结果。
- Driver 错误直接返回模型，不增加静默重试或伪成功。

如后续真实模型评测证明工具描述不足，再在 System Context 中加入短小的 Computer Use 指引；首期不预先增加隐藏提示词。

Computer Use 不限于 Notepad 等烟测应用。激活会话保留 NeCode 原有开发工具，因此支持以下调试闭环：

```text
启动或定位待调试应用
  → 操作 UI 复现问题
  → 获取截图与 UIA/AX 状态
  → 读取应用日志、终端输出和源码
  → 修改代码并重启应用
  → 重复 UI 操作完成回归验证
```

可覆盖 Electron、Qt、浏览器外原生桌面软件和本地开发工具。Computer Use 负责可见 UI 与输入，不替代原生调试器：进程内部状态、断点、调用栈和网络数据仍通过 Shell、日志、DevTools 或项目调试工具获取。

## 11. 桌面设置体验

Computer Use 显示在内置生产力插件列表中，不要求用户进入通用 MCP 编辑器。

列表行显示：

- 名称：Computer Use
- 描述按当前操作系统显示：Windows 为“控制 Windows 桌面应用”，macOS 为“控制 macOS 桌面应用”
- 平台状态
- Driver 版本
- `未安装 / 需要权限 / 已就绪 / 已连接 / 失败`
- 启用开关

详情页只显示当前操作系统相关信息，不向 Windows 用户展示 macOS 权限说明，也不向 macOS 用户展示 Windows 安装说明。按状态显示：

- Windows 安装命令与官方文档链接。
- macOS 安装命令、Accessibility 与 Screen Recording 状态，以及 `permissions grant` 指引。
- 已发现的绝对可执行路径。
- `doctor` 或 MCP 原始错误。
- 重新检测操作。

首期安装按钮只复制或展示官方命令，不在 NeCode 内执行远程脚本。

输入区能力菜单与插件设置共享同一运行时状态：插件未安装或失败时，`@电脑` 不能显示为可激活；插件恢复后无需重复配置 MCP。

## 12. 权限与安全边界

首期继续使用现有 MCP 工具权限：每个工具以 `cua-driver_<tool>` 进入 Permission Service。只读工具与修改工具不伪装为同一类成功状态。

以下限制必须在产品文案中明确：

- 当前不是 Codex Desktop 的应用级授权模型。
- 用户若配置全局 `* = allow`，NeCode 不会额外弹出应用白名单确认。
- macOS 系统权限授予 Cua Driver 身份，不授予 NeCode 自身。
- 不记录或上传窗口截图；遥测策略由用户安装的 Cua Driver 控制。
- NeCode 不替用户启用 Cua Driver 遥测，也不修改其本地遥测偏好。
- 只有用户通过 `@电脑` 激活的会话获得 Cua 工具，插件全局启用不等于所有会话都能控制桌面。
- 退出模式后必须从后续请求中移除工具，不能只隐藏前端状态。

应用级授权、高风险操作分类和敏感输入识别作为后续独立安全设计，不阻塞 MCP MVP。

首期至少区分只读桌面观察与修改操作。窗口枚举、窗口状态和健康检查可以沿用普通读取权限；点击、输入、快捷键、拖拽和启动/关闭应用继续进入现有 Permission Service。更细的应用级授权在后续安全设计中补齐。

## 13. macOS 特殊处理

- 使用绝对路径启动 Driver，不依赖 GUI PATH。
- 只读检查使用 `cua-driver permissions status --json`。
- 权限不足时不从后台进程直接触发系统弹窗；界面指导用户运行 `cua-driver permissions grant`，确保授权归属 `com.trycua.driver`。
- 不使用 `--embedded`，因为 NeCode 不携带 Driver，TCC 授权应归属独立 Cua Driver。
- 默认允许 Cua Driver 使用 daemon/proxy 行为，以保留后台输入和 Agent Cursor 能力。
- macOS 验收至少覆盖 TextEdit、Finder 和一个第三方桌面应用。

## 14. Desktop 配置目录迁移

Desktop 当前将 `OPENCODE_CONFIG_DIR` 指向 `<userData>/xdg-config/opencode`。改为 `<userData>/xdg-config/necode-desktop`。

启动迁移规则：

1. 新目录存在时直接使用，不合并旧目录。
2. 新目录不存在且旧目录存在时，将旧目录整体移动到新目录。
3. 跨卷或移动失败时复制到临时目录，校验关键文件后原子重命名。
4. 迁移失败时继续使用旧目录并记录真实错误，不能启动一个空的新配置目录。
5. 不删除迁移失败的旧目录。

迁移范围包含 `opencode.jsonc`、插件依赖、Skills、MCP 配置和其他用户文件。`xdg-data/opencode`、`xdg-cache/opencode`、`xdg-state/opencode` 暂不改名，以避免数据库、日志和缓存迁移扩大本功能风险。

## 15. 错误处理

- 未安装：显示平台对应安装指引，不持续重试启动。
- 版本命令失败：状态为 `failed`，显示退出码与 stderr。
- macOS 权限不足：状态为 `needs_permissions`，不显示为已连接。
- MCP 初始化失败：复用现有 MCP `failed` 状态和原始错误。
- `launch_app` 返回错误但窗口随后出现：不由 NeCode 伪造成功；保留 Driver 结果，由后续 `list_windows` 验证。
- 背景操作不支持：向模型返回 `background_unavailable`，不自动升级前台输入。
- 截图过大：继续使用现有媒体附件压缩与上下文清理机制。
- `@电脑` 激活失败：不进入模式，打开真实诊断信息。
- 退出清理失败：关闭 NeCode 工具注入并显示 Driver 清理错误。

## 16. 测试

### 16.1 运行时单元测试

- Windows PATH 与官方默认路径发现。
- macOS PATH、`~/.local/bin`、`/usr/local/bin`、Homebrew 路径发现。
- 平台不支持、未安装、版本失败和权限不足状态。
- 用户自定义 `mcp.cua-driver` 不被覆盖。
- 插件停用时不注入默认 MCP。
- Cua 工具允许列表只作用于内置 `cua-driver`。
- 未激活会话不包含 Cua 工具，激活后包含允许列表，退出后再次消失。
- Cua 工具的 `session` 参数绑定当前 NeCode Session ID。
- 激活状态在刷新和后续轮次中保持。

### 16.2 Desktop 测试

- Computer Use 行的状态、版本、路径与错误展示。
- 未安装和 macOS 权限不足指引。
- 启用、停用和重新检测。
- 不从界面直接执行远程安装脚本。
- `@` 菜单显示 Computer Use 能力项及不可用原因。
- 新会话和已有会话激活流程。
- “退出”和“停止并退出”状态与行为。
- 工具时间线保留目标应用、动作、截图结果和原始失败状态。
- 权限确认出现时任务暂停，拒绝后不继续执行后续桌面操作。

### 16.3 配置迁移测试

- 无旧目录。
- 只有旧目录。
- 新旧目录同时存在。
- 移动失败回退。
- 插件依赖和 `opencode.jsonc` 保留。

### 16.4 手工验收

Windows 11：

1. 启动 Notepad。
2. 获取窗口状态与截图。
3. 后台输入中英文。
4. 再次截图并验证文本完全一致。
5. 确认未保存文件且未操作其他窗口。

macOS：

1. 检查并授予 Accessibility 与 Screen Recording。
2. 启动 TextEdit，后台输入中英文并验证。
3. 枚举并读取 Finder 窗口。
4. 验证窗口被遮挡时仍能获取窗口截图。
5. 验证权限撤销后状态变为 `needs_permissions`。

应用调试验收：

1. 在 `@电脑` 激活后启动一个本地待调试应用。
2. 通过 UI 操作稳定复现一个可观察问题。
3. 同一会话读取日志或源码并完成修复。
4. 重启应用并通过 Computer Use 回归验证。
5. 点击“退出 Computer Use”，确认后续轮次不再获得 Cua 工具。

## 17. 完成标准

只有以下条件全部满足才视为完成：

1. NeCode 安装包不包含 Cua Driver 二进制，安装包体积不因本功能显著增加。
2. Windows 11 与 macOS 均能发现官方默认位置的 Driver。
3. Computer Use 以友好产品名称显示，未安装、权限不足和连接失败均显示真实状态。
4. 内置插件启用后通过标准 MCP 提供裁剪后的常用工具。
5. 不安装或依赖任何 Cua Skill。
6. MCP 图片能进入现有模型上下文并完成操作后验证。
7. Desktop 配置目录完成兼容迁移，现有用户配置不丢失。
8. 受影响包的定向测试和 `bun typecheck` 通过。
9. Windows 实机验收通过；macOS 实机验收结果明确记录，未验证项不得宣称完成。
10. `@电脑` 能激活当前会话，未激活会话不承担 Cua 工具上下文成本。
11. 用户可在不新建会话的情况下退出或停止并退出 Computer Use。
12. 至少完成一次“UI 复现问题 → 代码/日志诊断 → UI 回归验证”的应用调试验收。

## 18. 2026-07-15 实施验收记录

- 当前实现位于 `computer-use` 分支；Computer Use 内置插件默认停用，避免未使用该能力时启动外部 Driver。用户在“设置 > 插件”启用一次后，`@电脑` 才允许激活会话。
- Windows UI 实机反馈确认上述预启用步骤会把用户带入无操作按钮的只读详情页；本次修订已改为“选择 `@电脑` 自动启用插件并进入模式”，同时将插件描述收敛为仅显示当前操作系统。
- Windows 本机通过当前实现发现 Cua Driver `0.8.1`，绝对路径为 `C:\Users\11250\AppData\Local\Programs\Cua\cua-driver\bin\cua-driver.exe`，并生成 `cua-driver mcp` 配置；未复制或打包 Driver 二进制。
- Windows Driver 基线已完成 Notepad 的 `launch_app → get_window_state → type_text → get_window_state` 闭环；本分支未重启正在运行的 Desktop，因此新的 `@电脑` UI 尚未进行打包应用实机回归。
- Desktop、OpenCode、App 共 68 项定向测试通过；`packages/desktop`、`packages/opencode`、`packages/app`、`packages/sdk/js` 的 `bun typecheck` 均通过。
- `test/server/httpapi-session.test.ts` 当前 18 项中 17 项通过；`uses the persisted session directory for prompt requests` 在当前 Windows 环境超过测试自身 5 秒超时。Computer Use 的 Session helper、HTTP schema 和 SDK 生成测试均通过。
- macOS 已完成路径顺序、`permissions status --json`、`permissions grant` 恢复指引和“不使用 `--embedded`”的静态验证；尚无 macOS 实机验收，不能宣称 macOS 完成。
- “UI 复现问题 → 代码/日志诊断 → UI 回归验证”的完整应用调试验收尚未在本分支执行。
