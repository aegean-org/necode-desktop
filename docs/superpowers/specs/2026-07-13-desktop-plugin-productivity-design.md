# NeCode 桌面插件中心与生产力插件设计

## 1. 背景

NeCode 当前已经具备服务端插件加载、npm 与本地插件安装、插件 Hook、自定义工具、插件元数据以及 TUI 插件管理能力，但桌面端只读取 `config.plugin` 并展示一个固定绿色状态点。该列表无法反映插件是否真正加载成功，也不能安装、启停、卸载或查看错误。

项目同时具备独立的技能发现机制和工具附件协议，但尚未提供 Documents、PDF、Spreadsheets、Presentations 四类开箱即用的第一方生产力插件。

本设计同时完成两个目标：

1. 在桌面端提供完整的插件管理闭环。
2. 默认接入四个 NeCode 第一方生产力插件。

## 2. 设计目标

- 桌面端可以查看内置、npm 和本地插件的真实运行状态。
- 支持安装、启用、停用和卸载外部插件。
- 配置变化后自动重建当前实例，不要求退出或重启 NeCode。
- 四个第一方插件随桌面端预装、默认启用，工具依赖按需加载。
- 第一方和第三方插件使用同一套注册表、状态协议和桌面管理界面。
- 插件可声明技能、工具、展示信息和兼容性信息。
- 所有失败按真实阶段和原始错误展示，不使用固定成功状态或模拟结果。
- 保持 npm、本地文件及旧版插件配置的兼容性。

## 3. 非目标

- 首期不建设插件市场、评分、评论、排行榜或第三方发布平台。
- 不兼容或再分发 Codex 的 `.codex-plugin/plugin.json` 专有插件包。
- 不实现 Computer Use、Chrome Control 或 Visualize 的宿主运行时。
- 不让插件直接向桌面 SolidJS 应用注入任意组件；桌面端只渲染标准插件管理界面。

## 4. 总体架构

```text
桌面插件页面
    │
    ▼
Plugin HTTP API
    │
    ├── PluginConfig：持久配置、安装、启停、卸载
    ├── PluginRegistry：统一元数据与真实状态
    ├── PluginLoader：解析、兼容性检查、加载 Hook
    └── Skill Discovery：发现已启用插件声明的技能
            │
            ▼
Documents / PDF / Spreadsheets / Presentations
```

### 4.1 包职责

- `packages/core`：公共插件配置 Schema。
- `packages/plugin`：插件清单、状态、能力和公共 Hook 类型。
- `packages/opencode`：安装、配置持久化、注册表、加载、技能接入和 HTTP API。
- `packages/app`：Craft 风格桌面插件管理页面。
- `packages/desktop`：打包生产力插件依赖，不承载插件业务规则。
- 四个第一方生产力插件使用独立 workspace 包，避免扩大核心运行时文件。

## 5. 统一插件模型

每个插件在注册表中形成一条统一记录：

```ts
type PluginEntry = {
  key: string; id: string; name: string
  description?: string; version?: string
  source: "builtin" | "npm" | "file"; scope: "builtin" | "global" | "local"
  enabled: boolean; status: "active" | "disabled" | "failed" | "incompatible"
  capabilities: PluginCapability[]
  tools: string[]; skills: string[]
  error?: { stage: PluginFailureStage; message: string }
  canDisable: boolean; canUninstall: boolean
}
```

`key` 是配置与启停状态使用的稳定身份：

- `builtin:documents`、`builtin:pdf`、`builtin:spreadsheets`、`builtin:presentations`
- `npm:@scope/package`、`file:C:/absolute/path`

插件声明的 `id` 用于运行时和展示，不能替代安装来源键。

清单解析由不依赖 Hook 运行时的 PluginCatalog 负责，PluginLoader 和技能发现共同消费该目录，避免 Plugin 与 Skill 服务形成循环依赖。

## 6. 插件清单

插件继续通过 npm `package.json` 暴露 `./server` 和可选的 `./tui` 入口，并增加可选 NeCode 元数据：

```json
{
  "exports": {
    "./server": "./dist/server.js"
  },
  "necode": {
    "plugin": {
      "id": "documents",
      "name": "Documents",
      "description": "创建和读取 Word 文档",
      "icon": "./assets/icon.svg",
      "skills": ["./skills/"]
    }
  }
}
```

清单中的相对路径必须解析在插件包目录内。缺少 NeCode 元数据的旧插件仍然可以加载，界面使用包名作为名称并显示“未提供插件元数据”。无效清单直接进入 `failed/manifest` 状态。

## 7. 持久配置与生命周期

### 7.1 配置

外部插件安装来源继续保存在现有 `plugin` 数组中。新增顶层 `plugin_enabled` 映射，为内置和外部插件提供统一启停状态：

```json
{
  "plugin": ["@example/necode-plugin"],
  "plugin_enabled": {
    "builtin:documents": false,
    "npm:@example/necode-plugin": false
  }
}
```

映射中没有对应键时：

- 第一方内置生产力插件默认为启用。
- 已配置的外部插件默认为启用。

现有 `tui.plugin_enabled` 和 TUI KV 中的插件状态按稳定键迁移到顶层映射，之后 TUI 与桌面端共同读写该状态。配置写入必须保留 JSONC 注释、属性顺序和无关字段，原型敏感键必须使用自有属性判断。

### 7.2 生命周期

```text
发现安装来源
  → 读取清单
  → 检查兼容性
  → 注册元数据
  → 读取启用状态
  → 加载 Hook 和技能
  → active / failed
```

安装、启停或卸载成功后，服务端调用已有实例废弃机制。桌面端刷新查询时获得重建后的注册表，因此无需重启应用，也不在旧实例中维护第二套可变 Hook 容器。

停用插件后，其 Hook、工具和技能必须同时消失。卸载外部插件只删除配置引用，不删除共享 npm 缓存中的其他包。

## 8. HTTP API

沿用 MCP 的运行状态与持久配置分离模式：

```text
GET /plugin                 GET /plugin/config
POST /plugin/config         PUT /plugin/config/:pluginKey
DELETE /plugin/config/:pluginKey
```

- `GET /plugin`：返回合并后的真实注册表状态。
- `GET /plugin/config`：返回可管理的安装与启停配置。
- `POST /plugin/config`：安装 npm 包或注册本地插件。
- `PUT /plugin/config/:pluginKey`：更新启用状态。
- `DELETE /plugin/config/:pluginKey`：卸载外部插件；内置插件返回明确错误。

安装请求包含 `spec` 和 `scope`。本地插件由桌面文件选择器生成绝对路径，用户不需要手填 Windows 路径。

所有接口必须进入 OpenAPI，并使用 `./packages/sdk/js/script/build.ts` 重新生成 JavaScript SDK。

## 9. 桌面交互

### 9.1 导航和列表

设置侧栏在 MCP 与技能之间增加“插件”。页面头部右侧提供“安装插件”，下方提供本地搜索。

列表分为“内置功能”“已安装”和默认折叠的“系统组件”。系统组件包括认证、Provider 和 NeCode 内部插件，展示真实状态但不提供停用或卸载操作。

```text
内置
  Documents       文档创建与读取        运行中  [开关]
  PDF             PDF 读取与生成         运行中  [开关]
  Spreadsheets    表格创建与分析         运行中  [开关]
  Presentations   演示文稿创建与读取     运行中  [开关]
已安装
  example-plugin  npm · v1.2.0           运行中  [开关] […]
系统组件
  Codex Auth      内部认证插件            运行中
```

每行显示图标、名称、描述、来源、版本、能力标签、真实状态、启用开关和更多菜单。点击整行打开详情；开关和菜单阻止行点击。

### 9.2 详情

插件详情展示：

- 介绍、来源、版本和安装位置。
- 当前状态、失败阶段和错误文本。
- 提供的工具和技能。
- 权限需求。
- 启用、停用和卸载操作。

生产力内置插件不显示卸载操作；系统组件同时不显示停用操作。失败状态不能使用绿色圆点。

### 9.3 安装

安装对话框提供两种方式：

1. npm 包名：输入包名，读取清单并预览后确认安装。
2. 本地插件：通过桌面文件选择器选择目录或入口文件。

安装范围默认为当前项目，可切换为全局。安装成功后自动刷新实例；初始化失败时保留已安装配置并显示真实错误，便于修复或卸载。

## 10. 第一方生产力插件

### 10.1 Documents

- 读取 DOCX 并转换为结构化文本，从 Markdown 或结构化内容生成 DOCX。
- 编辑时读取现有内容并生成新版本，不承诺无损保留任意第三方 DOCX 的复杂样式；返回真实 `.docx` 文件附件。
- 写入使用 `docx`，读取复用现有 `markit-ai`。

### 10.2 PDF

- 提取 PDF 文本和页面信息，从结构化内容生成 PDF。
- 合并和拆分 PDF，对加密、损坏和字体加载失败返回明确错误。
- 使用 `pdf-lib`，随插件打包许可兼容的字体资产并保留许可证。

### 10.3 Spreadsheets

- 读取 XLSX 工作簿、工作表和单元格，创建工作簿。
- 新增或修改工作表和单元格。
- 支持基础公式、格式以及以图片形式嵌入的图表，不声明生成原生 Excel 图表对象。
- 使用 `exceljs` 并返回真实 `.xlsx` 文件附件。

### 10.4 Presentations

- 读取 PPTX 文本和页面结构，根据大纲和结构化内容创建 PPTX。
- 修改由 NeCode 生成的演示文稿源结构后重新生成。
- 返回真实 `.pptx` 文件附件。
- 使用 `pptxgenjs`，读取复用现有 `markit-ai`。
- 不声明无损编辑任意第三方 PPTX。

## 11. 文件与权限

未指定输出路径时，产物写入 NeCode 用户数据目录下按会话隔离的产物目录，并作为消息附件返回，不污染项目工作树。

用户明确指定项目或外部路径时，插件通过现有工具权限上下文请求写入权限。插件不得执行文档宏或嵌入脚本。损坏、加密或不支持的输入必须显式失败。

## 12. 错误处理

- 不吞掉安装、清单、兼容性、入口、加载或初始化错误。
- 不把“已配置”显示为“运行中”。
- 不生成空文件、模板文件或模拟成功结果。
- 文件生成完成后必须重新打开验证，验证失败则工具调用失败且不返回成功附件。
- 配置持久化失败时接口直接失败；实例重建后的加载错误进入注册表并可在桌面端诊断。

## 13. 测试与验收

### 13.1 运行时

- 配置 Schema、JSONC 写入和作用域合并测试。
- 内置、npm、本地、禁用、失败和不兼容状态测试。
- 使用临时真实插件包验证加载，不复制实现逻辑到 mock。
- 安装、启停和卸载后验证实例自动重建。
- 验证停用插件后工具和技能均不可用。

### 13.2 API 与 SDK

- 覆盖五个插件管理接口及错误响应。
- 检查 OpenAPI 源码、`packages/sdk/openapi.json` 和生成 SDK 同步。
- 后端测试单次运行硬超时为 60 秒。

### 13.3 桌面端

- 覆盖列表分组、搜索、详情、安装、启停、卸载和错误展示。
- 验证按钮不会触发行点击。
- 验证长名称、错误文本和窄窗口布局不被截断。
- 状态点颜色必须来自真实状态。

### 13.4 生产力插件

- 每个插件生成至少一个真实文件。
- 使用对应读取库重新打开产物并检查关键内容。
- 验证附件 MIME、文件名和 URL。
- 验证损坏输入和不可写路径返回明确错误。

### 13.5 最终验证

- 分别在受影响包目录运行 `bun typecheck` 和相关测试。
- 生成 SDK 后检查工作树，避免遗漏生成文件。
- 构建桌面产物并在开发模式或打包版本中验证完整交互。
- 不主动重启用户当前运行的 NeCode 实例。

## 14. 完成标准

只有以下条件全部满足，A+B 才视为完成：

1. 桌面端插件页面使用真实注册表，能查看生产力插件、外部插件和系统组件，而不是读取配置后固定显示成功。
2. npm 和本地插件可以安装、查看、启停和卸载。
3. 配置变化不要求用户退出或重启 NeCode。
4. 四个第一方插件预装、默认启用，并可在桌面端停用。
5. 四个插件的工具与技能可被模型发现并真实执行。
6. DOCX、PDF、XLSX、PPTX 产物均通过重新读取验证。
7. 所有错误均可在桌面插件详情中定位到失败阶段。
8. OpenAPI、SDK、自动化测试和桌面实测均通过。
