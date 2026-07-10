# Craft Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reversible archive, persistent session pinning, shared session action menus, and explicit project removal copy to the Craft-style NeCode workflow UI.

**Architecture:** Extend the persisted Session time contract with `pinned`, make archive and pin updates nullable so timestamps can be cleared, and regenerate the SDK. Keep workflow projection pure, use one shared app mutation client and one reusable row action menu, then wire Home and Session workflow surfaces to those units.

**Tech Stack:** TypeScript, Effect Schema, Drizzle SQLite, SolidJS, TanStack Query, Bun test, generated JavaScript SDK, NeCode Electron development runtime.

## Global Constraints

- Work in `D:\project\opencode` so the running NeCode development app receives hot updates.
- Preserve all unrelated uncommitted changes already present in the checkout.
- Run tests and `bun typecheck` from package directories, never from the repository root.
- Backend test commands have a hard timeout of 60 seconds.
- Do not change session execution, provider routing, model routing, or tool execution.
- Delete is permanent and always requires confirmation.
- Project removal never deletes project files, Git state, worktrees, or sessions.
- Do not introduce mock success, silent fallback, or swallowed errors.

---

### Task 1: Persist pinned session state

**Files:**
- Modify: `packages/core/src/session/sql.ts`
- Modify: `packages/core/src/session/info.ts`
- Modify: `packages/core/src/session/projector.ts`
- Modify: `packages/opencode/src/session/session.ts`
- Modify: `packages/opencode/test/session/session-schema.test.ts`
- Modify: `packages/opencode/test/session/schema-decoding.test.ts`
- Modify: `packages/opencode/test/session/session.test.ts`
- Generate: `packages/core/src/database/migration/<timestamp>_add_session_pinned.ts`
- Generate: `packages/core/src/database/migration.gen.ts`
- Generate: `packages/core/src/database/schema.gen.ts`
- Generate: `packages/core/schema.json`

**Interfaces:**
- Produces: `Session.Info.time.pinned?: number`.
- Produces: `Session.Interface.setPinned({ sessionID, time? })`.
- Produces: persisted `session.time_pinned` and pinned-first list ordering.

- [ ] **Step 1: Add failing schema tests**

Extend the schema fixtures with `pinned: undefined`, assert the optional key is omitted, and decode a full record containing `pinned: 250`:

```ts
expect(Object.hasOwn(encoded.time as Record<string, unknown>, "pinned")).toBe(false)

time: { created: 100, updated: 200, compacting: 150, pinned: 250, archived: 300 }
```

- [ ] **Step 2: Add a failing persistence test**

Add a session service test that creates a session, pins it, reads it back, unpins it, and reads it back again:

```ts
const info = yield* session.create({})
yield* session.setPinned({ sessionID: info.id, time: 123 })
expect((yield* session.get(info.id)).time.pinned).toBe(123)
yield* session.setPinned({ sessionID: info.id })
expect((yield* session.get(info.id)).time.pinned).toBeUndefined()
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run from `packages/opencode`:

```powershell
bun test test/session/session-schema.test.ts test/session/schema-decoding.test.ts test/session/session.test.ts
```

Expected: FAIL because `pinned` and `setPinned` do not exist.

- [ ] **Step 4: Add the database and schema fields**

Add `time_pinned: integer()` beside `time_archived`, project it through Core and OpenCode Session representations, and add optional `pinned` to the public time schema.

The OpenCode session service method is:

```ts
const setPinned = Effect.fn("Session.setPinned")(function* (input: { sessionID: SessionID; time?: number }) {
  yield* patch(input.sessionID, { time: { pinned: input.time } }).pipe(Effect.orDie)
})
```

Order root/global session lists by pinned timestamp before updated time:

```ts
.orderBy(desc(SessionTable.time_pinned), desc(SessionTable.time_updated), desc(SessionTable.id))
```

- [ ] **Step 5: Generate the database migration**

Run from `packages/core`:

```powershell
bun run script/migration.ts --name add_session_pinned
```

Expected: one migration adding `time_pinned`, updated schema snapshot, schema generator, and migration registry.

- [ ] **Step 6: Run focused tests and migration check**

```powershell
cd D:\project\opencode\packages\opencode
bun test test/session/session-schema.test.ts test/session/schema-decoding.test.ts test/session/session.test.ts
cd D:\project\opencode\packages\core
bun run script/migration.ts --check
```

Expected: PASS.

---

### Task 2: Expose reversible archive and pin updates over HTTP

**Files:**
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/session.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts`
- Create: `packages/opencode/test/server/session-update-schema.test.ts`
- Regenerate: `packages/sdk/openapi.json`
- Regenerate: `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- Regenerate: `packages/sdk/js/src/v2/gen/types.gen.ts`

**Interfaces:**
- Produces: `client.session.update({ time: { archived: number | null, pinned: number | null } })`.
- `null` clears the timestamp; omitted values remain unchanged.

- [ ] **Step 1: Add the failing HTTP payload schema test**

Decode both set and clear payloads through `UpdatePayload`:

```ts
expect(Schema.decodeUnknownSync(UpdatePayload)({ time: { archived: null, pinned: null } })).toEqual({
  time: { archived: null, pinned: null },
})
```

- [ ] **Step 2: Run the test and verify RED**

Run from `packages/opencode`:

```powershell
bun test test/server/session-update-schema.test.ts
```

Expected: FAIL because null and pinned are rejected.

- [ ] **Step 3: Implement nullable update semantics**

Use `Schema.NullOr(Session.ArchivedTimestamp)` for both values. In the handler, distinguish omitted from explicit null with `Object.hasOwn`:

```ts
if (ctx.payload.time && Object.hasOwn(ctx.payload.time, "archived")) {
  yield* session.setArchived({ sessionID: ctx.params.sessionID, time: ctx.payload.time.archived ?? undefined })
}
if (ctx.payload.time && Object.hasOwn(ctx.payload.time, "pinned")) {
  yield* session.setPinned({ sessionID: ctx.params.sessionID, time: ctx.payload.time.pinned ?? undefined })
}
```

- [ ] **Step 4: Regenerate the JavaScript SDK**

Run from repository root:

```powershell
bun packages/sdk/js/script/build.ts
```

Expected: generated client accepts nullable archive and pin timestamps.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
cd D:\project\opencode\packages\opencode
bun test test/server/session-update-schema.test.ts test/session/session.test.ts
bun typecheck
```

Expected: PASS.

---

### Task 3: Extend workflow projection for pinned and archived sessions

**Files:**
- Modify: `packages/app/src/pages/home/workflow-task.ts`
- Modify: `packages/app/src/pages/home/workflow-task.test.ts`
- Modify: `packages/app/src/pages/home/workflow-sidebar.tsx`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`

**Interfaces:**
- Produces: `WorkflowTask.pinnedAt?: number` and `WorkflowTask.archivedAt?: number`.
- Produces filters/groups `pinned` and `archived`.
- Keeps the underlying status unchanged while a task is pinned.

- [ ] **Step 1: Add failing projection tests**

Add tests proving pinned tasks form the first group, archived sessions are excluded from active tasks, and archived records are projected only by the archived builder:

```ts
expect(groupWorkflowTasks(tasks).map((group) => group.id)).toEqual(["pinned", "recent"])
expect(tasks.find((task) => task.id === "ses_pinned")?.status).toBe("ready")
expect(buildArchivedWorkflowTasks(input).map((task) => task.id)).toEqual(["ses_archived"])
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/home/workflow-task.test.ts
```

Expected: FAIL because pinned/archived projection APIs do not exist.

- [ ] **Step 3: Implement projection and navigation filters**

Add `pinned` before status groups and `archived` after active groups. `filterWorkflowTasks` returns archived tasks only when passed the separately loaded archived array; active `all` never includes archived sessions.

- [ ] **Step 4: Add translated labels**

Add equivalent keys:

```ts
"home.tasks.filter.pinned": "Pinned"
"home.tasks.filter.archived": "Archived"
"home.tasks.filter.pinned": "置顶"
"home.tasks.filter.archived": "已归档"
```

- [ ] **Step 5: Run focused tests**

```powershell
bun test src/pages/home/workflow-task.test.ts
```

Expected: PASS.

---

### Task 4: Create shared session mutation and action-menu units

**Files:**
- Create: `packages/app/src/pages/session/session-management.ts`
- Create: `packages/app/src/pages/session/session-management.test.ts`
- Create: `packages/app/src/pages/session/workflow-session-actions.tsx`
- Create: `packages/app/src/pages/session/workflow-session-actions.test.tsx`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`

**Interfaces:**
- Produces: `createSessionManagement({ client, directory })` with `archive`, `restore`, `pin`, `unpin`, and `remove`.
- Produces: `WorkflowSessionActions` with reversible menu actions and confirmed permanent delete.

- [ ] **Step 1: Add failing request-shaping tests**

Use a real generated client with a recording fetch transport and assert requests:

```ts
await actions.restore("ses_1")
expect(await request.json()).toEqual({ time: { archived: null } })

await actions.unpin("ses_1")
expect(await request.json()).toEqual({ time: { pinned: null } })
```

- [ ] **Step 2: Run the tests and verify RED**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/session/session-management.test.ts src/pages/session/workflow-session-actions.test.tsx
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the mutation client**

Each method awaits the generated SDK response and throws when response data is absent. Do not catch inside the model; UI callers own visible toasts.

- [ ] **Step 4: Implement the action menu**

Render pin/unpin as a dedicated icon action and render rename, archive/restore, and delete in `MenuV2`. Delete opens a confirmation dialog containing the session title and invokes `onDelete` only from the destructive confirmation button.

- [ ] **Step 5: Run focused tests**

```powershell
bun test src/pages/session/session-management.test.ts src/pages/session/workflow-session-actions.test.tsx
```

Expected: PASS.

---

### Task 5: Wire Home workflow actions and archived loading

**Files:**
- Modify: `packages/app/src/pages/home.tsx`
- Create: `packages/app/src/pages/home/workflow-task-row.tsx`
- Create: `packages/app/src/pages/home/workflow-task-row.test.tsx`
- Modify: `packages/app/src/pages/home/workflow-inspector.tsx`

**Interfaces:**
- Consumes: `createSessionManagement`, `WorkflowSessionActions`, active and archived workflow projection.
- Produces: Home task rows and inspector actions for pin, archive/restore, and delete.

- [ ] **Step 1: Add failing row contract tests**

Render a pinned active row and an archived row. Assert accessible labels for unpin/archive/delete and restore/delete respectively.

- [ ] **Step 2: Run the test and verify RED**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/home/workflow-task-row.test.tsx
```

Expected: FAIL because the extracted row does not exist.

- [ ] **Step 3: Load archived root sessions only for the archived filter**

Use the focused server SDK experimental session list for each selected project directory:

```ts
client.experimental.session.list({ directory, roots: true, archived: true, limit: HOME_SESSION_LIMIT })
```

Do not inject archived rows into active sync stores.

- [ ] **Step 4: Wire shared actions**

After successful archive/delete, clear invalid active selection. After restore/pin/unpin, invalidate or reload the relevant query/store so server data remains authoritative. Surface failures with the existing toast utility.

- [ ] **Step 5: Extract the touched row markup**

Move the Home workflow row and its action controls into `workflow-task-row.tsx` so the already-large `home.tsx` does not grow further.

- [ ] **Step 6: Run focused tests**

```powershell
bun test src/pages/home/workflow-task.test.ts src/pages/home/workflow-task-row.test.tsx
```

Expected: PASS.

---

### Task 6: Wire Session navigator and opened-session header

**Files:**
- Modify: `packages/app/src/pages/session.tsx`
- Modify: `packages/app/src/pages/session/workflow-session-navigator.tsx`
- Modify: `packages/app/src/pages/session/timeline/message-timeline.tsx`
- Modify: `packages/app/src/pages/session/helpers.test.ts`

**Interfaces:**
- Consumes: shared mutation client and action menu.
- Produces: the same pin/archive/delete behavior in workflow navigator and opened-session header.

- [ ] **Step 1: Add failing navigator action assertions**

Extend Session workflow tests to assert the active row exposes pin and overflow actions and that archive removal navigates to a valid neighboring session.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/session/helpers.test.ts src/pages/session/workflow-session-actions.test.tsx
```

Expected: FAIL on missing navigator actions.

- [ ] **Step 3: Wire navigator row actions**

Pass shared callbacks from `session.tsx` to `WorkflowSessionNavigator`. Prevent row action clicks from selecting/opening the row.

- [ ] **Step 4: Delegate opened-session mutations**

Replace direct update/delete request construction in `message-timeline.tsx` with the shared mutation client while preserving existing navigation, tab cleanup, rename, sharing, and error toasts.

- [ ] **Step 5: Run focused tests**

```powershell
bun test src/pages/session/helpers.test.ts src/pages/session/session-management.test.ts src/pages/session/workflow-session-actions.test.tsx
```

Expected: PASS.

---

### Task 7: Clarify project removal copy

**Files:**
- Modify: `packages/app/src/pages/home.tsx`
- Modify: `packages/app/src/pages/layout/sidebar-project.tsx`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Modify: `packages/app/src/i18n/zht.ts`
- Modify: `packages/app/src/pages/layout/helpers.test.ts`

**Interfaces:**
- Produces: `project.removeFromNecode` translated copy while retaining local-only close behavior.

- [ ] **Step 1: Add a failing copy assertion**

Assert the project menu uses the dedicated translation key instead of `common.close`.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
cd D:\project\opencode\packages\app
bun test src/pages/layout/helpers.test.ts
```

Expected: FAIL until the menu contract is updated.

- [ ] **Step 3: Update both project menus and translations**

Use `project.removeFromNecode` with English `Remove from NeCode`, Simplified Chinese `从 NeCode 移除`, and Traditional Chinese `從 NeCode 移除`. Keep the existing `projects.close(directory)` behavior unchanged.

- [ ] **Step 4: Run the focused test**

```powershell
bun test src/pages/layout/helpers.test.ts
```

Expected: PASS.

---

### Task 8: Full verification and live NeCode validation

**Files:**
- Verify all modified files.

**Interfaces:**
- Produces: fresh automated and visible evidence for every approved behavior.

- [ ] **Step 1: Run combined focused tests**

```powershell
cd D:\project\opencode\packages\core
bun test test/database-migration.test.ts
cd D:\project\opencode\packages\opencode
bun test test/session/session-schema.test.ts test/session/schema-decoding.test.ts test/session/session.test.ts test/server/session-update-schema.test.ts
cd D:\project\opencode\packages\app
bun test src/pages/home/workflow-task.test.ts src/pages/home/workflow-task-row.test.tsx src/pages/session/session-management.test.ts src/pages/session/workflow-session-actions.test.tsx src/pages/session/helpers.test.ts src/pages/layout/helpers.test.ts
```

Expected: all pass with zero failures.

- [ ] **Step 2: Run package typechecks**

```powershell
cd D:\project\opencode\packages\core
bun typecheck
cd D:\project\opencode\packages\opencode
bun typecheck
cd D:\project\opencode\packages\app
bun typecheck
```

Expected: exit code 0 for all packages.

- [ ] **Step 3: Verify generated artifacts and formatting**

```powershell
cd D:\project\opencode
git diff --check
cd D:\project\opencode\packages\core
bun run script/migration.ts --check
```

Expected: no whitespace errors and no ungenerated migration changes.

- [ ] **Step 4: Build the app**

```powershell
cd D:\project\opencode\packages\app
bun run build
```

Expected: production build exits 0.

- [ ] **Step 5: Validate in the current NeCode development window**

Using Computer Use:

1. Pin a disposable session and verify it enters the Pinned group.
2. Unpin it and verify normal status grouping returns.
3. Archive it and verify it disappears from active filters.
4. Open Archived, restore it, and verify it returns.
5. Open Delete, verify the confirmation copy, then cancel without deleting user data.
6. Verify Home task rows and Session navigator rows expose the same actions.
7. Open a project menu and verify `从 NeCode 移除` is shown without triggering it.

- [ ] **Step 6: Review the final diff against the specification**

Confirm every requirement in `docs/superpowers/specs/2026-07-10-craft-session-management-design.md` has implementation and verification evidence. Report any unmet requirement directly instead of claiming completion.
