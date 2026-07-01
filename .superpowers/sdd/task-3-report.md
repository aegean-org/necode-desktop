# Task 3 Report: Migrate Home Workflow Inbox to Shared Primitives

## Status

DONE

## NEEDS_CONTEXT Resolution

The previous stop was valid: the RED test proved `workflowTaskMeta(...)` returned `[]` for a running task because `packages/app/src/pages/home/workflow-task.ts` only projected permission/question/todo metadata.

The resumed task explicitly allowed `packages/app/src/pages/home/workflow-task.ts` in Task 3 scope. I included it in the implementation and commit so the brief-requested Home projection test could be made green.

## Summary

- Kept the brief-requested RED test in `packages/app/src/pages/home/workflow-task.test.ts`.
- Extended `workflowTaskMeta(...)` so complete Home workflow tasks project stable row metadata ids in this order:
  - `status`
  - `updated`
  - pending signal metadata (`permission`, `question`, `todo`) when present
- Preserved existing signal-only helper usage by keeping old partial inputs valid.
- Migrated Home task rows from page-local row markup to `WorkflowEntityRow`, with `WorkflowEntityList`, `WorkflowPanelHeader`, and `WorkflowSectionHeader` used around the inbox.
- Kept status labels on existing `workflowStatusTitleKey(...)` keys.
- Kept relative updated time rendering in UI code through `DateTime.fromMillis(...).toRelative()`.
- Aligned Home sidebar, overview, and inspector surfaces with Task 2 shared constants:
  - `WORKFLOW_NAV_ROW`
  - `WORKFLOW_SURFACE_BUTTON`
  - `WORKFLOW_SURFACE_CARD`
- Removed public Craft wording from the Task 3 files touched in this pass.

## Files Committed

- `packages/app/src/pages/home.tsx`
- `packages/app/src/pages/home/workflow-sidebar.tsx`
- `packages/app/src/pages/home/workflow-overview.tsx`
- `packages/app/src/pages/home/workflow-inspector.tsx`
- `packages/app/src/pages/home/workflow-task.ts`
- `packages/app/src/pages/home/workflow-task.test.ts`

## Verification

Initial RED reproduction from `D:\project\opencode\packages\app`:

```powershell
bun test src/pages/home/workflow-task.test.ts
```

Result before the fix: `8 pass`, `1 fail`, `16 expect() calls`; failing assertion expected `["status", "updated"]` and received `[]`.

GREEN and final verification from `D:\project\opencode\packages\app`:

```powershell
bun test src/pages/home/workflow-task.test.ts
```

Result: `9 pass`, `0 fail`, `16 expect() calls`.

```powershell
bun test src/pages/home/workflow-task.test.ts src/components/workflow-ui.test.ts
```

Result: `17 pass`, `0 fail`, `42 expect() calls`.

```powershell
bun typecheck
```

Result: `tsgo -b` completed with exit code 0.

## Scope Control

- Staged and committed only the six Task 3 source/test files listed above.
- Left unrelated dirty checkout changes untouched.
- Updated this report after the source commit, so it is not included in the Task 3 source commit.

## Commit

- `152b1c46e feat(app): align home workflow inbox`

## Review Finding Fix: Home Workflow Row Selection

### Summary

- Fixed `HomeWorkflowTaskRow` so `WorkflowEntityRow.onSelect` only calls `previewTask`.
- Kept pointer/focus preview behavior on the row wrapper through `onFocusIn` and `onPointerEnter`.
- Kept session opening as the existing `WorkflowEntityRow.actions` button labeled with `home.tasks.detail.open`.
- Added a focused regression test proving the Home task row selection binding stays separate from the open-session action.

### RED Verification

From `D:\project\opencode\packages\app`:

```powershell
bun test src/pages/home/workflow-task.test.ts
```

Result before the fix: `9 pass`, `1 fail`, `19 expect() calls`; the failing assertion expected `onSelect={props.previewTask}` but the row source still contained `props.previewTask()` followed by `props.openSession(props.task.session)`.

### Final Verification

From `D:\project\opencode\packages\app`:

```powershell
bun test src/pages/home/workflow-task.test.ts
```

Result after the fix: `10 pass`, `0 fail`, `20 expect() calls`.

```powershell
bun test src/pages/home/workflow-task.test.ts src/components/workflow-ui.test.ts
```

Result: `18 pass`, `0 fail`, `46 expect() calls`.

```powershell
bun typecheck
```

Result: `tsgo -b` completed with exit code 0.

### Commit

- `4fee8e645 fix(app): keep home workflow row selection local`

## Review Finding Fix: Code Metrics Split

### Summary

- Split `HomeWorkflowInspector` into local components for header, empty state, task detail, metrics, progress, signals, and context.
- Split `HomeWorkflowTaskRow` into local row title, subtitle, icon, badge, trailing, and status-dot components.
- Preserved existing Home workflow behavior: selecting the row still only previews/selects, and opening the session still only happens through the action button or inspector.
- Did not change session execution, model/provider routing, backend concepts, or public OpenCode/workflow naming.

### Metrics Verification

From `D:\project\opencode`:

```powershell
bun -e <inline function line-count script>
```

Result after the fix: all new or changed functions are under the 50-line limit:

- `HomeWorkflowInspector`: 23
- `InspectorHeader`: 28
- `InspectorEmptyState`: 17
- `InspectorTaskDetail`: 16
- `InspectorMetrics`: 22
- `InspectorProgress`: 20
- `InspectorSignals`: 29
- `InspectorContext`: 15
- `HomeWorkflowTaskRow`: 37
- `HomeWorkflowTaskTitle`: 9
- `HomeWorkflowTaskSubtitle`: 12
- `HomeWorkflowTaskIcon`: 14
- `HomeWorkflowTaskBadge`: 9
- `HomeWorkflowTaskTrailing`: 3
- `HomeWorkflowTaskStatusDot`: 3

### Final Verification

From `D:\project\opencode\packages\app`:

```powershell
bun test src/pages/home/workflow-task.test.ts src/components/workflow-ui.test.ts
```

Result: `18 pass`, `0 fail`, `46 expect() calls`.

```powershell
bun typecheck
```

Result: `tsgo -b` completed with exit code 0.
