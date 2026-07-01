# Craft 风格工作流 UI 需求设计文档

## 状态

已确认方向：以方案 1 为主，方案 2 作为约束。

- 主线：Shell-First 工作流闭环，优先把 Home、Session 详情、多栏、列表、右侧辅助面板、输入区做成一个完整工作台。
- 约束：Component-First，不再靠截图逐块补丁，所有可复用视觉和交互必须沉淀到共享 workflow 组件和 token。

本文档是需求和设计文档，不是实现计划。后续实现计划需要基于本文拆成可执行任务。

## 背景与问题

OpenCode 本身具备较强的 coding agent 执行能力，但桌面端体验仍偏向“聊天页 + 附加侧栏”。用户目标是参考 Craft Agents、Zcode、Codex 这类工作流桌面产品，把 OpenCode 改造成更完整的桌面 Agent 工作台。

之前已经做过一轮 workflow shell 改造，也出现过截图驱动的局部修改和回滚。后续不能继续用“截图指出一块，就改一块”的方式推进。需要先固定需求、信息架构、组件边界和验收标准，再进入实现。

## 总目标

1. 让 OpenCode 桌面端从“固定居中聊天界面”转为“多栏工作流 Agent 工作台”。
2. 参考 Craft Agents 的 panel stack、entity list、panel header、compact drill-in、输入区 dock 和整体层次。
3. 保持 OpenCode 自己的产品概念，不硬搬 Craft 的 `Sources`、`Automations` 等信息架构。
4. 第一阶段围绕 Home 和 Session 详情形成可见闭环。
5. 所有 UI 改动优先通过共享组件完成，避免页面局部 class 堆叠。
6. 不重写 OpenCode 的 session 执行、模型调用、tool 执行和 provider 路由。

## 非目标

1. 第一阶段不新增 Craft 式 `Sources` 后端模型。
2. 第一阶段不新增 Automations 后端能力。
3. 不重写 OpenCode session core、tool execution、provider/model routing。
4. 不做营销页或 landing page。
5. 不做纯视觉换皮，所有视觉调整都必须服务工作流闭环。
6. 不加入 mock 成功路径、静默 fallback 或隐藏错误的兼容逻辑。

## Craft 源码参考

Craft Agents 本地源码路径：

`D:\project\craft-agents-oss`

重点参考文件：

- `apps/electron/src/renderer/components/app-shell/PanelStackContainer.tsx`
  - 参考桌面 panel stack、compact navigator/detail 过渡、固定 sidebar/navigator 宽度、内容 panel 伸缩、滚动阴影空间。
- `apps/electron/src/renderer/components/app-shell/PanelSlot.tsx`
  - 参考 content panel chrome、focused panel、close/back action 注入、`PANEL_MIN_WIDTH`。
- `apps/electron/src/renderer/components/app-shell/PanelHeader.tsx`
  - 参考统一 panel header、标题菜单、actions、compact leading action、标题截断。
- `apps/electron/src/renderer/components/app-shell/panel-constants.ts`
  - 参考常量：`PANEL_GAP = 6`、`PANEL_EDGE_INSET = 6`、`RADIUS_INNER = 10`、`PANEL_MIN_WIDTH = 440`、`PANEL_STACK_VERTICAL_OVERFLOW = 8`。
- `apps/electron/src/renderer/components/app-shell/SessionList.tsx`
  - 参考分组列表、搜索模式、键盘导航、折叠状态、状态分组和空状态。
- `apps/electron/src/renderer/components/app-shell/SessionItem.tsx`
  - 参考 session row 插槽、状态图标、右侧元数据、context menu、多选和 compact menu。
- `apps/electron/src/renderer/components/ui/entity-list.tsx`
  - 参考通用分组 entity list。
- `apps/electron/src/renderer/components/ui/entity-row.tsx`
  - 参考通用 row skeleton、hover、selected、菜单显示、分隔线、long press compact menu、title/subtitle/badge 布局。
- `apps/electron/src/renderer/components/app-shell/input/ChatInputZone.tsx`
  - 参考输入区如何成为 content panel 的一部分，而不是悬浮在页面上的独立卡片。

## 当前 OpenCode 落点

第一阶段应围绕以下文件组织：

- `packages/app/src/components/workflow-shell.tsx`
- `packages/app/src/components/workflow-shell-state.ts`
- `packages/app/src/components/workflow-ui.tsx`
- `packages/app/src/pages/home.tsx`
- `packages/app/src/pages/home/workflow-sidebar.tsx`
- `packages/app/src/pages/home/workflow-overview.tsx`
- `packages/app/src/pages/home/workflow-inspector.tsx`
- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/workflow-session-sidebar.tsx`
- `packages/app/src/pages/session/workflow-session-navigator.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/composer/session-composer-region.tsx`
- `packages/app/src/pages/session/timeline/message-timeline.tsx`
- `packages/app/src/components/titlebar.tsx`
- `packages/app/src/components/titlebar-workflow.ts`

## 概念映射

OpenCode 不能直接照搬 Craft 信息架构，必须用 OpenCode 自己的产品概念承载 Craft 的工作流体验。

| Craft 概念 | OpenCode 第一阶段映射 | 要求 |
| --- | --- | --- |
| Sessions | Sessions / workflow tasks | 用 Craft 风格分组列表、状态表达、选中和右键交互。 |
| Navigator panel | Session navigator / task list | Home 和 Session 详情都把它作为核心中间列。 |
| Content panel stack | 主聊天/执行内容 panel | 使用 content panel chrome、最小宽度、输入区 dock。 |
| Left sidebar | Projects / Workspaces / OpenCode 主导航 | 保持 OpenCode 原生分类。 |
| Sources | 第一阶段不直接映射 | 不创建假的 Sources；未来可映射到 MCP、providers、files、integrations。 |
| Skills | Agents / commands / plugins / skills 入口 | 第一阶段只定义兼容导航模式，不强制完整实现。 |
| Automations | 未来能力入口 | 第一阶段不做后端能力。 |
| Labels / Views / Filters | Session/task 状态筛选和分组 | 使用 OpenCode 现有数据投影，不搬 Craft 数据模型。 |

## 用户体验原则

1. App 首屏必须是可操作工作台，不是说明页或欢迎页。
2. 桌面端体验类似邮件/任务客户端：左侧上下文、中间列表、右侧主详情、可选辅助面板。
3. shell、panel、row、header、input dock 必须看起来属于一个系统。
4. 避免整页纯白。shell 背景、panel 背景、content 背景、hover、selected、muted card、badge 必须有层次。
5. 列表应密集、可扫描、可操作，不使用大卡片式营销布局。
6. 右侧 panel 是辅助信息，不应和主 content panel 争夺视觉主次。
7. 窄屏/移动端不能硬挤三栏，应转为 navigator/detail drill-in 交互。
8. 所有阶段性修改必须可通过共享组件回滚或调整。

## 全局布局需求

### WorkflowShell

`WorkflowShell` 是 Home 和 Session 详情在 `newLayoutDesigns` 模式下的根布局。

必须支持四个 slot：

1. `left`：项目/工作区/主导航，轻量 slot，不加 raised panel chrome。
2. `navigator`：任务/会话列表，raised panel。
3. `center`：主内容，raised content panel。
4. `right`：文件、上下文、review 等辅助 panel，raised panel。

几何常量要求：

- gap：`6px`
- edge inset：`6px`
- inner radius：`10px`
- edge radius：`8px`
- content min width：`440px`
- stack vertical overflow：`8px`

行为要求：

1. 支持用户拖拽固定 panel 宽度。
2. 宽度持久化到 shell storage key。
3. viewport 变化后必须 clamp 持久化宽度，保证 content 不低于最小宽度。
4. 右侧 panel 可以不存在，不应留下死空白。
5. shell 和 panel 必须保留 `data-component` / `data-panel-role`，用于测试和视觉核对。
6. workflow CSS variables 必须局部作用于 workflow shell，不污染全局主题。

### 桌面端行为

1. 宽屏下显示 left + navigator + content + optional right。
2. navigator 和 right panel 可拖拽调整宽度。
3. resize handle 命中区域要足够大，并有 hover/resizing 反馈。
4. 只有固定 panel 宽度总和超过 viewport 时才允许横向 overflow。
5. content panel 应是主视觉焦点，但不能压扁 navigator 或 right panel。

### 窄屏/移动端行为

第一阶段默认决策：先建立 compact 边界和避免重叠；完整动画过渡放到第二阶段。

最终要求：

1. 不渲染被挤压的三栏桌面布局。
2. 使用 navigator/detail drill-in：
   - navigator 保持 mounted
   - detail 激活时保持 mounted
   - 通过 slide 或等价过渡在列表和详情之间切换
3. detail header 提供 leading back action。
4. 会被 narrow panel 裁切的菜单改为 drawer 或 compact menu。
5. 输入区不能遮挡消息内容。

## 页面需求

### Home：工作流 Inbox

Home 是 OpenCode 工作流收件箱。

布局要求：

1. 左栏：projects/workspaces 和 OpenCode 主导航。
2. 中间：workflow task/session 列表。
3. 右栏：选中任务/session 的详情、状态、最近信号和主操作。

交互要求：

1. 选择任务后，右侧 inspector 更新。
2. 打开任务后进入相关 Session 详情。
3. 列表支持 needs action、running、ready、done 等状态分组。
4. 空状态必须提供可执行动作。
5. 搜索结果和普通列表使用同一套 row/list 组件。
6. 不出现 Craft-only 的 Sources/Automations 分类。

视觉要求：

1. 任务列表使用 entity-list 密度和轻分隔。
2. 选中态必须可见，可用左侧 2px accent 或等价方式。
3. inspector 内部使用小型 muted surface，不允许嵌套大卡片。
4. metrics、signals、context chip 使用共享 badge/card token。

### Session 详情：Agent 工作台

Session 详情使用和 Home 相同的 shell。

布局要求：

1. 左栏：项目/工作区导航。
2. navigator：当前 workspace 相关 session/task 列表。
3. content：当前消息时间线、执行流和 composer。
4. right：文件树、上下文、review、辅助信息。

交互要求：

1. 从 navigator 切换 session 时更新 active detail。
2. active session row 保持选中态。
3. session 切换后 composer focus 必须可预测，不应无故抢焦点。
4. right panel 不存在时不留死空白。
5. 文件/context/review tab 使用 workflow panel header 和 compact segmented control。
6. message timeline 如果保留自己的 sticky title row，它的视觉必须和 content panel 一致。

视觉要求：

1. content panel surface 应和 navigator/right panel 有轻微差别。
2. composer dock 必须属于 content panel。
3. timeline 不能漂浮在不相关的白底上。
4. 文件/context/review 内容使用和 shell 一致的 panel/list 密度。

### Titlebar 和 App Chrome

1. `newLayoutDesigns` 模式下避免重复 session tabs 或与 workflow shell 竞争的顶部 chrome。
2. titlebar 仍需保持平台适配。
3. help/feedback 入口不能浮在 workflow panel 上方，除非它是 shell 设计的一部分。
4. app chrome 不能遮挡 resize handle、panel header、compact back control。

## 共享组件需求

### WorkflowShell

职责：

1. 管理 panel 几何、固定 panel sizing、data attributes。
2. 集中维护 Craft-derived constants。
3. 局部注入 workflow surface variables。
4. 提供 resize constraints 和持久化。
5. 提供 compact-mode API。

非职责：

1. 不拥有 session 数据。
2. 不决定 task 分组。
3. 不渲染页面业务菜单。

### WorkflowPanelHeader

职责：

1. 统一渲染 42px workflow panel header。
2. 支持 title、badge、actions、leading action、未来 title menu。
3. 长标题必须正确截断。
4. actions 区域必须保留空间，避免文字和按钮重叠。
5. 后续支持 compact back action。

要求：

1. 默认 header 保持轻量，不再局部随意加重。
2. header 样式调整必须通过组件和 token 完成。
3. actions 优先使用图标按钮，并提供 tooltip/aria label。

### WorkflowEntityList / WorkflowEntityRow

职责：

1. 提供分组列表结构。
2. 支持 selected、hover、keyboard focus、separator、title、subtitle、badge、trailing metadata、context menu slots。
3. 为 compact touch/menu 留出结构。

要求：

1. Home task row、Session navigator row、未来 agent/plugin 列表都应复用同一族组件。
2. 多选是未来兼容需求，第一阶段不能用结构阻断。
3. 有 focus 基础设施的列表必须支持键盘导航。

### WorkflowSidebarNav

职责：

1. 渲染 OpenCode 原生主导航。
2. 支持 projects/workspaces、sessions/tasks、agents/commands/plugins、settings、help/feedback 等入口。
3. 不使用没有真实 backing concept 的 Craft label。

要求：

1. sidebar row 使用轻量 hover/selected。
2. sidebar 不使用 raised panel chrome。
3. 后续支持 collapsed/compact。

### WorkflowChatInputDock

职责：

1. 把 composer 纳入 content panel。
2. 让 mode/model/context 控件和 composer 视觉上属于同一 dock。
3. 为 timeline 预留空间，避免消息被 composer 遮挡。

实现默认决策：

1. 第一阶段先包裹现有 `SessionComposerRegion`，不要先重写 composer 内部。
2. permission/admin/credential prompt 必须保留明确错误和状态。
3. dock 必须兼容 compact 模式和键盘 focus。

## 数据与状态需求

第一阶段使用现有 OpenCode 数据：

1. session 和 project/workspace 状态来自当前 app state。
2. workflow task projection 来自现有 session metadata、todo/status 数据。
3. 通过 `settings.general.newLayoutDesigns()` gate workflow layout。
4. right panel 使用现有 file/context/review 状态。
5. composer 和 message timeline 使用现有状态。

规则：

1. 不用 Craft 概念命名 OpenCode 数据结构，除非语义完全等价。
2. 新导航 metadata 使用 OpenCode 术语：workspace、project、session、task、agent、command、plugin、context。
3. workflow projection logic 和渲染组件分离。
4. task projection、list grouping、resize constraints 必须有测试覆盖。

## 交互需求

### 选择与焦点

1. row 选择更新 active detail 或 inspector。
2. keyboard focus 在 sidebar、navigator、content、right panel 之间可预测移动。
3. active selection 和 keyboard focus 视觉上可区分。
4. session 切换不应自动抢 composer focus，除非用户执行的是“打开并输入”类动作。

### 右键和菜单

1. 桌面 row 提供 context menu 或 overflow actions。
2. compact row 使用 drawer/compact menu，避免 popover 被裁切。
3. long press 或右键打开菜单后不能同时触发行选择。

### Resize

1. 拖拽实时更新 panel 宽度。
2. 约束明确、可测试。
3. viewport 变化后 clamp 持久化宽度。
4. 无效持久化宽度回到文档化默认值。

### 状态表达

列表至少表达以下状态，前提是现有数据可用：

- running
- needs action
- ready
- done
- unread 或 pending prompt

状态不应只依靠文本，应组合图标、颜色、badge 或 row treatment。

## 视觉需求

1. shell、panel、content、row hover、row selected、muted card、badge 必须有不同 token。
2. 不允许 page section 被做成 floating card。
3. 不允许 card 嵌套 card。
4. repeated card/row radius 控制在 8px 或以内，除非 shell 常量要求 10px。
5. panel actions 优先使用 icon button。
6. row/header 文本必须截断，不得覆盖 actions。
7. panel 内使用紧凑字号，不使用 hero-scale typography。
8. hover、badge、loading state 不应导致布局跳动。

## 可访问性需求

1. 可导航列表应有 role 和 aria label。
2. row 支持键盘访问。
3. icon-only button 必须有 aria label 或 tooltip。
4. compact back button 必须有可访问名称。
5. selection state 应通过 data attribute 和必要 aria state 表达。

## 阶段划分

### Phase 1：Workflow Closure

范围：

1. 稳定 workflow shell 和 token layer。
2. 完成 Home workflow inbox。
3. 完成 Session detail shell 集成。
4. 对齐 right panel 和 composer dock。
5. 添加 panel surface 和 data attribute 的视觉/DOM smoke checks。

验收：

1. Home 和 Session detail 共用同一个 shell primitive。
2. 页面内不再重复实现核心 header/list/row 行为。
3. light/dark theme 下 panel 层次可见。
4. `packages/app` 下 `bun typecheck` 通过。
5. workflow shell、home task、session helper 相关 targeted tests 通过。

### Phase 2：Component Hardening

范围：

1. 进一步拆分 row/list/header/sidebar/dock primitives。
2. 补 keyboard list interactions、resize constraints、compact menu tests。
3. 把页面内重复 row 结构迁移到共享组件。
4. 实现 compact navigator/detail 过渡。

验收：

1. Home task row 和 Session navigator row 共用 row primitive。
2. compact mode 是 navigator/detail，而不是挤压三栏。
3. resize behavior 覆盖 viewport changes。

### Phase 3：OpenCode 原生信息架构扩展

范围：

1. 在真实 OpenCode 概念上增加 agents、commands、plugins、settings、provider/MCP 相关入口。
2. 为 provider/MCP/files integrations 定义未来映射，但不称为 Craft `Sources`。
3. 只有真实数据 backing 时才新增 entity list。

验收：

1. 左侧导航仍是 OpenCode-native。
2. 不出现空的 Craft 分类。
3. 新 navigation item 复用 workflow shell/list primitives。

## 实现规划默认决策

1. Phase 1 只建立 compact layout 边界并避免重叠；完整 animated navigator/detail transitions 放到 Phase 2。
2. multi-panel content stack 放到 Phase 2。Phase 1 保持一个 active content panel，并保留可复用的 data attributes。
3. Phase 1 后第一个非 session workflow list 优先考虑 agents/commands/plugins，因为它们比 Craft `Sources` 更贴近 OpenCode。
4. composer docking 从 `WorkflowChatInputDock` 包裹现有 `SessionComposerRegion` 开始，不先重写 composer 内部。

## 测试需求

静态和单测：

1. 从 `packages/app` 运行 `bun typecheck`。
2. 从 `packages/app` 运行 targeted tests：
   - `src/components/workflow-shell-state.test.ts`
   - `src/pages/home/workflow-task.test.ts`
   - `src/pages/session/helpers.test.ts`
   - 修改 titlebar 行为时运行 titlebar workflow tests

视觉和交互检查：

1. smoke/DOM check 覆盖：
   - Home 和 Session detail 存在 `[data-component="workflow-shell"]`
   - 需要时存在 `[data-panel-role="sidebar"]`、`navigator`、`content`、`right-sidebar`
   - content panel 最小宽度生效
   - workflow CSS variables 被限制在 shell 内
2. 用截图或 computed style 验证 light/dark 下 panel surface 差异。
3. workflow routes 不新增 console/page errors。

手工检查：

1. 打开 Home workflow layout。
2. 选择多个 task，确认 inspector 更新。
3. 打开 Session detail route。
4. 从 navigator 切换 session。
5. 切换 file/context/review right panel。
6. 拖拽 navigator 和 right panel。
7. 缩窄 viewport，确认布局不重叠。

## 回滚与安全要求

1. workflow layout 稳定前保留 `settings.general.newLayoutDesigns()` gate。
2. core session flows 达到 parity 前不删除 legacy layout。
3. 每次实现都应按小范围可审 slices 推进，并附带测试。
4. 回滚时按 workflow shell 文件精确处理，不使用全局 reset。
5. 实现期间保留无关 dirty files，不顺手清理。

## 成功标准

1. Home 和 Session detail 看起来属于同一个工作流桌面 App。
2. 当前 UI 不再像固定宽度居中聊天页加侧栏。
3. Craft 风格 panel layering、entity list、header、input dock 清晰可见。
4. 信息架构和文案保持 OpenCode-native。
5. 后续 UI 改造有共享组件路径，不再依赖截图反复局部修补。

