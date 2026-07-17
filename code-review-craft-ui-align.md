# Code Review 报告

**分支**: `craft-ui-align`  
**审查日期**: 2026-07-17  
**修改文件**: 53 个文件 (+693, -146)

---

## 概述

本次改动围绕 Workflow UI 对齐进行改进，主要涉及启动画面重构、Titlebar 增强、Workflow Shell 布局优化、Layout 上下文扩展和 Session 管理增强。

---

## ✅ 优点

### 1. 组件提取清晰
`StartupSplash` 独立组件结构清晰，骨架屏动画设计合理，统一了连接检查时的加载 UI。

### 2. 状态管理规范
使用 `creatingWorkflowSessions` Set 防止重复创建会话，模式规范。

### 3. CSS 变量解耦良好
Titlebar 使用 `--titlebar-background` 传递背景色给 workflow shell，解耦设计合理。

### 4. 工具函数逻辑清晰
`layout-helpers.ts` 中的 `duplicateProjectDirectories` 和 `projectWorkspaceDirectories` 函数逻辑清晰，职责单一。

---

## ⚠️ 问题与建议

### 1. 【高优先级】Overlay 逻辑矛盾

**位置**: `packages/app/src/components/workflow-shell.tsx:133-137`

```typescript
const sizingVisible: PanelVisibility = {
  left: visible.left,
  navigator: visible.navigator,
  right: createMemo(() => layoutMode() === "desktop" && visible.right()),
}
```

**问题**: 
- `right` 面板在 compact 模式下被设置为隐藏
- 但 overlay 属性却在 compact 模式下启用 (`overlay={rightVisible() && sizing.layoutMode() === "compact"}`)
- 这会导致右侧面板在 compact 模式下完全消失，而不是以悬浮方式显示

**建议**:
```typescript
const sizingVisible: PanelVisibility = {
  left: visible.left,
  navigator: visible.navigator,
  right: visible.right, // 始终跟随 visible.right
}
```

让 `sizingVisible.right` 始终等于 `visible.right`，overlay 只影响渲染样式而非可见性计算。

---

### 2. 【中优先级】openWorkflowProject 性能风险

**位置**: `packages/app/src/pages/session.tsx:284-300`

```typescript
const openWorkflowProject = async (directory: string) => {
  const project = layout.projects.list().find((item) => item.worktree === directory)
  const latest = latestRootSession(
    await Promise.all(
      [directory, ...(project?.sandboxes ?? [])].map(async (item) => ({
        path: { directory: item },
        session: await serverSDK()
          .client.session.list({ directory: item })
          .then((response) => response.data ?? [])
          .catch(() => []),
      })),
    ),
    Date.now(),
  )
  // ...
}
```

**问题**:
1. 并发请求所有 sandbox 的 session list，当 sandbox 数量多时可能导致大量网络请求
2. 没有超时控制，网络慢时会卡住整个导航流程
3. `catch(() => [])` 吞掉了所有错误，调试困难

**建议**:
```typescript
const openWorkflowProject = async (directory: string) => {
  const project = layout.projects.list().find((item) => item.worktree === directory)
  const directories = [directory, ...(project?.sandboxes ?? [])]
  
  // 限制并发数为 3
  const results = await Promise.allSettled(
    directories.slice(0, 5).map(async (item) => {
      try {
        const response = await serverSDK()
          .client.session.list({ directory: item })
        return response.data ?? []
      } catch (error) {
        console.warn(`Failed to list sessions for ${item}`, error)
        return []
      }
    }),
  )
  
  const sessions = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const latest = latestRootSession(
    directories.map((dir, i) => ({ path: { directory: dir }, session: results[i]?.status === 'fulfilled' ? results[i].value : [] })),
    Date.now(),
  )
  
  if (latest) return openWorkflowSession(latest)
  await openWorkflowProjectNewSession(directory)
}
```

---

### 3. 【中优先级】模块级可变状态

**位置**: `packages/app/src/pages/session.tsx:301`

```typescript
const creatingWorkflowSessions = new Set<string>()
```

**问题**: 模块级 Set 在热重载 (HMR) 时不会重置，可能导致开发环境下状态错乱。

**建议**: 移动到组件内部或使用 Store 管理：

```typescript
// 方案 1: 移动到组件内部
export default function Page() {
  const creatingWorkflowSessions = createStore(new Set<string>())
  
  const openWorkflowProjectNewSession = async (directory: string) => {
    if (creatingWorkflowSessions.has(directory)) return
    // ...
  }
}

// 方案 2: 使用 Effect 清理
const cleanupCreatingSessions = () => creatingWorkflowSessions.clear()
onCleanup(cleanupCreatingSessions)
```

---

### 4. 【低优先级】createWorkflowPanelVisibility 参数不完整

**位置**: `packages/app/src/components/workflow-shell.tsx:241-243`

```typescript
function createWorkflowPanelVisibility(props: WorkflowShellProps): PanelVisibility {
  return {
    left: createMemo(() => props.navigationOpen !== false && !!props.left),
    navigator: createMemo(() => props.navigationOpen !== false && !!props.navigator),
    right: createMemo(() => !!props.right),
  }
}
```

**问题**: 函数签名删除了 `layoutMode` 参数，但注释中提到 `right` 应该在 desktop 模式才显示。现在 `right` 永远显示，与原有设计不符。

**建议**: 恢复 layoutMode 参数或添加注释说明设计意图变更。

---

### 5. 【低优先级】insertWorkflowSession 类型安全

**位置**: `packages/app/src/pages/session/workflow-new-session.ts:19-27`

```typescript
export function insertWorkflowSession(sessions: Session[], session: Session) {
  const result = Binary.search(sessions, session.id, (item) => item.id)
  const next = [...sessions]
  if (result.found) {
    next[result.index] = session
    return next
  }
  next.splice(result.index, 0, session)
  return next
}
```

**问题**: 函数假设 `sessions` 数组已按 `id` 排序，但没有类型约束或运行时校验。如果传入未排序数组，`Binary.search` 会返回错误索引。

**建议**: 添加 JSDoc 注释说明前置条件：

```typescript
/**
 * Inserts a session into a sorted array by session ID.
 * @param sessions - Array of sessions sorted by id (ascending)
 * @param session - Session to insert
 * @returns New array with session inserted or updated
 */
export function insertWorkflowSession(sessions: Session[], session: Session) {
  // ...
}
```

---

### 6. 【低优先级】CSS 类名过长

**位置**: `packages/app/src/components/titlebar.tsx:237-238`

```typescript
"isolate h-9 overflow-visible before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:-z-10 before:w-screen before:content-[''] before:bg-(image:--titlebar-background)"
```

**问题**: 单行 200+ 字符的 classList，难以维护和调试。

**建议**: 提取到 CSS 文件：

```css
/* titlebar.css */
.titlebar-v2 {
  @apply isolate h-9 overflow-visible;
  &::before {
    @apply pointer-events-none absolute inset-y-0 left-0 -z-10 w-screen;
    content: '';
    background-image: var(--titlebar-background);
  }
}
```

---

### 7. 【低优先级】魔法字符串数组

**位置**: `packages/app/src/components/startup-splash.tsx:3`

```typescript
const bars = ["w-24", "w-32", "w-20", "w-28"]
```

**问题**: 硬编码的宽度值，缺乏注释说明用途。

**建议**: 添加注释：

```typescript
// Skeleton screen bar widths for visual hierarchy
const bars = ["w-24", "w-32", "w-20", "w-28"]
```

---

## 📊 修改统计

| 类别 | 文件数 | 变更说明 |
|------|--------|----------|
| 新增文件 | 4 | startup-splash.tsx, workflow-new-session.ts + 测试 |
| 核心组件 | 5 | app.tsx, titlebar.tsx, workflow-shell.tsx, layout.tsx, session.tsx |
| i18n | 21 | 所有语言文件各 +1 行 |
| 测试文件 | 8 | 新增/更新测试 |
| UI 组件 | 5 | basic-tool, message-part, session-review 等 |
| **总计** | **53** | **+693, -146** |

---

## 📋 行动项

### 必须修复
- [ ] #1: 修复 overlay 可见性逻辑矛盾

### 建议修复
- [ ] #2: 为 openWorkflowProject 添加并发限制和错误日志
- [ ] #3: 将 creatingWorkflowSessions 移到组件内部

### 可选优化
- [ ] #4: 补充 createWorkflowPanelVisibility 设计意图注释
- [ ] #5: 为 insertWorkflowSession 添加 JSDoc
- [ ] #6: 提取 titlebar CSS 类名
- [ ] #7: 为 startup-splash 常量添加注释

---

## 总结

整体代码质量良好，组件拆分合理，状态管理规范。主要问题集中在边界情况处理和性能优化方面。建议优先修复 overlay 逻辑问题，其他问题可在后续迭代中逐步优化。
