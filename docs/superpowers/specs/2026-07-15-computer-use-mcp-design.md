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
- 首期复用 NeCode 现有工具权限机制，不宣称已经具备 Codex Desktop 的应用级授权能力。
- Desktop 配置目录从 `xdg-config/opencode` 迁移为 `xdg-config/necode-desktop`，保留旧目录兼容迁移。

## 3. 目标

1. 用户安装 Cua Driver 后，NeCode Desktop 能自动发现并连接其 MCP Server。
2. 用户未安装 Driver、macOS 权限不足或 MCP 连接失败时，界面显示真实状态和可执行的恢复指引。
3. NeCode 不因 Computer Use 增加桌面安装包体积。
4. 模型只接收首期需要的常用 Computer Use 工具，减少工具上下文和误调用。
5. Windows 与 macOS 使用同一套 MCP 会话、图片附件和模型工具执行链路。
6. 现有用户升级后保留插件、MCP、Skills 与其他全局配置。

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
```

NeCode 的内置插件只负责发现、配置和展示。桌面操作仍由外部 Cua Driver 进程完成，MCP 图片继续复用 `packages/opencode/src/session/tools.ts` 的附件转换链路。

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

## 9. 模型执行约束

不新增 Skill。主要约束来自 Cua Driver 的工具描述：

- 操作目标必须来自 `list_windows` 或 `launch_app` 返回的 `pid + window_id`。
- element action 前必须对同一窗口调用 `get_window_state`。
- 默认先使用后台输入；仅在 Driver 明确返回 `background_unavailable` 后才允许前台升级。
- 修改操作后再次调用 `get_window_state` 验证结果。
- Driver 错误直接返回模型，不增加静默重试或伪成功。

如后续真实模型评测证明工具描述不足，再在 System Context 中加入短小的 Computer Use 指引；首期不预先增加隐藏提示词。

## 10. 桌面设置体验

Computer Use 显示在内置生产力插件列表中，不要求用户进入通用 MCP 编辑器。

列表行显示：

- 名称：Computer Use
- 描述：控制 Windows 和 macOS 桌面应用
- 平台状态
- Driver 版本
- `未安装 / 需要权限 / 已就绪 / 已连接 / 失败`
- 启用开关

详情页按状态显示：

- Windows 安装命令与官方文档链接。
- macOS 安装命令、Accessibility 与 Screen Recording 状态，以及 `permissions grant` 指引。
- 已发现的绝对可执行路径。
- `doctor` 或 MCP 原始错误。
- 重新检测操作。

首期安装按钮只复制或展示官方命令，不在 NeCode 内执行远程脚本。

## 11. 权限与安全边界

首期继续使用现有 MCP 工具权限：每个工具以 `cua-driver_<tool>` 进入 Permission Service。只读工具与修改工具不伪装为同一类成功状态。

以下限制必须在产品文案中明确：

- 当前不是 Codex Desktop 的应用级授权模型。
- 用户若配置全局 `* = allow`，NeCode 不会额外弹出应用白名单确认。
- macOS 系统权限授予 Cua Driver 身份，不授予 NeCode 自身。
- 不记录或上传窗口截图；遥测策略由用户安装的 Cua Driver 控制。
- NeCode 不替用户启用 Cua Driver 遥测，也不修改其本地遥测偏好。

应用级授权、高风险操作分类和敏感输入识别作为后续独立安全设计，不阻塞 MCP MVP。

## 12. macOS 特殊处理

- 使用绝对路径启动 Driver，不依赖 GUI PATH。
- 只读检查使用 `cua-driver permissions status --json`。
- 权限不足时不从后台进程直接触发系统弹窗；界面指导用户运行 `cua-driver permissions grant`，确保授权归属 `com.trycua.driver`。
- 不使用 `--embedded`，因为 NeCode 不携带 Driver，TCC 授权应归属独立 Cua Driver。
- 默认允许 Cua Driver 使用 daemon/proxy 行为，以保留后台输入和 Agent Cursor 能力。
- macOS 验收至少覆盖 TextEdit、Finder 和一个第三方桌面应用。

## 13. Desktop 配置目录迁移

Desktop 当前将 `OPENCODE_CONFIG_DIR` 指向 `<userData>/xdg-config/opencode`。改为 `<userData>/xdg-config/necode-desktop`。

启动迁移规则：

1. 新目录存在时直接使用，不合并旧目录。
2. 新目录不存在且旧目录存在时，将旧目录整体移动到新目录。
3. 跨卷或移动失败时复制到临时目录，校验关键文件后原子重命名。
4. 迁移失败时继续使用旧目录并记录真实错误，不能启动一个空的新配置目录。
5. 不删除迁移失败的旧目录。

迁移范围包含 `opencode.jsonc`、插件依赖、Skills、MCP 配置和其他用户文件。`xdg-data/opencode`、`xdg-cache/opencode`、`xdg-state/opencode` 暂不改名，以避免数据库、日志和缓存迁移扩大本功能风险。

## 14. 错误处理

- 未安装：显示平台对应安装指引，不持续重试启动。
- 版本命令失败：状态为 `failed`，显示退出码与 stderr。
- macOS 权限不足：状态为 `needs_permissions`，不显示为已连接。
- MCP 初始化失败：复用现有 MCP `failed` 状态和原始错误。
- `launch_app` 返回错误但窗口随后出现：不由 NeCode 伪造成功；保留 Driver 结果，由后续 `list_windows` 验证。
- 背景操作不支持：向模型返回 `background_unavailable`，不自动升级前台输入。
- 截图过大：继续使用现有媒体附件压缩与上下文清理机制。

## 15. 测试

### 15.1 运行时单元测试

- Windows PATH 与官方默认路径发现。
- macOS PATH、`~/.local/bin`、`/usr/local/bin`、Homebrew 路径发现。
- 平台不支持、未安装、版本失败和权限不足状态。
- 用户自定义 `mcp.cua-driver` 不被覆盖。
- 插件停用时不注入默认 MCP。
- Cua 工具允许列表只作用于内置 `cua-driver`。

### 15.2 Desktop 测试

- Computer Use 行的状态、版本、路径与错误展示。
- 未安装和 macOS 权限不足指引。
- 启用、停用和重新检测。
- 不从界面直接执行远程安装脚本。

### 15.3 配置迁移测试

- 无旧目录。
- 只有旧目录。
- 新旧目录同时存在。
- 移动失败回退。
- 插件依赖和 `opencode.jsonc` 保留。

### 15.4 手工验收

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

## 16. 完成标准

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
