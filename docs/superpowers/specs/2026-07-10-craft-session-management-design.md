# Craft Session Management Design

## Objective

Complete the Craft-style workflow shell's session-management parity without changing session execution, provider routing, or tool behavior. Users must be able to manage sessions from the Home task list and the Session navigator instead of opening a session merely to find hidden legacy actions.

## Current State

- The Home task row and workflow Session navigator expose only selection/open actions.
- The opened Session header already exposes rename, archive, and delete.
- The server already supports permanent session deletion and setting an archive timestamp.
- Archive removal is not exposed through the HTTP update contract, so the desktop UI has no supported restore flow.
- Project rows already provide `Close`, but the label does not explain that it only removes the project from NeCode navigation.
- No user-visible session pin contract exists. Internal cache pinning is unrelated.

## Product Decisions

### Session row actions

Desktop task/session rows reveal two actions on hover or keyboard focus:

1. Pin or unpin.
2. An overflow menu containing rename, archive or restore, and delete.

Opening or previewing a task remains the primary row action. Delete stays inside the overflow menu and always requires confirmation.

### Archive lifecycle

Archive is reversible:

- Active lists exclude archived sessions.
- The Home workflow navigator includes an `Archived` filter.
- Selecting `Archived` loads archived root sessions for the current server/project scope.
- Archived rows expose `Restore` and `Delete`, not `Archive`.
- Restoring clears the archive timestamp and returns the session to normal workflow grouping.

Archive and restore failures remain visible through error toasts. No silent local-only state is allowed.

### Pin lifecycle

Pin is a first-class persisted session property represented by `time.pinned` and stored as `session.time_pinned`.

- Pinning writes the current timestamp.
- Unpinning clears the timestamp.
- Pinned active sessions appear in a `Pinned` group before status-derived groups.
- Pinned sessions remain visible when their normal workflow status changes.
- Archived sessions are not shown in `Pinned`; restoring preserves their pin timestamp.
- Session queries order pinned sessions before unpinned sessions so an older pinned session is not lost behind client limits.

### Project removal

The project action label becomes `Remove from NeCode` / `从 NeCode 移除`.

The action continues to remove only the local navigation entry. It must not delete the project directory, Git repository, worktrees, or sessions.

## Architecture

### Runtime and API

Extend the Session time contract with optional `pinned` and allow session updates to accept `null` for `time.archived` and `time.pinned`:

- number: set the timestamp;
- null: clear the timestamp;
- omitted: leave the value unchanged.

The session service keeps explicit `setArchived` and `setPinned` operations. Session list ordering places pinned rows first, then uses the existing updated-time ordering.

The JavaScript SDK is regenerated with `packages/sdk/js/script/build.ts` after the OpenAPI contract changes.

### Shared app actions

Create a focused app session-management module that owns:

- archive;
- restore;
- pin;
- unpin;
- permanent delete and descendant cleanup;
- optimistic store removal/update;
- navigation/tab cleanup;
- visible error reporting.

The Home workflow and Session detail surfaces call this shared contract rather than copying request and store-update logic.

### Workflow projection

Extend `WorkflowTask` with pin/archive information derived from the Session record. Projection remains separate from rendering.

Active task grouping order is:

1. Pinned
2. Needs action
3. Running
4. Recent
5. Done

Archived tasks are loaded separately and are only rendered for the `Archived` filter.

### UI composition

Create a reusable workflow session action menu used by:

- Home task rows;
- the Home inspector header;
- Session workflow navigator rows.

The existing opened-session header may keep its visual menu, but it must delegate mutations to the same session-management contract.

## Accessibility

- Row actions must be reachable on keyboard focus, not only pointer hover.
- Every icon button has an explicit translated label and title.
- Overflow menu items use the same translated action names across surfaces.
- Delete remains separated from reversible actions.
- Compact layouts use the existing menu primitive rather than a clipped custom popover.

## Error Handling

- API errors surface through existing request-failure toasts.
- Delete confirmation remains open until the request succeeds or visibly fails.
- Optimistic changes are applied only after successful requests unless the existing sync event already provides the authoritative update.
- No mock success, swallowed error, or local-only fallback is introduced.

## Testing

### Runtime

- Session schema encodes and decodes `time.pinned`.
- Session persistence round-trips pinned timestamps.
- HTTP update accepts `null` to clear archive and pin timestamps.
- Session list ordering keeps pinned sessions before unpinned sessions.

### App

- Workflow projection creates the Pinned and Archived groups correctly.
- Pinning does not replace the underlying workflow status.
- Archived filters exclude active sessions and support restored sessions.
- Shared action helpers produce the correct update/delete requests.
- Home and Session navigator rows expose the expected action-menu DOM contract.
- Project removal copy states that only the NeCode navigation entry is removed.

### Verification

- Run focused Bun tests from `packages/core`, `packages/opencode`, and `packages/app`.
- Run `bun typecheck` from each affected package.
- Regenerate and verify the JavaScript SDK.
- Run the app production build.
- Use the current NeCode development window to verify pin, unpin, archive, archived filtering, restore, delete confirmation, and project removal copy.

## Non-Goals

- Bulk selection or bulk archive/delete.
- Drag-and-drop ordering.
- Project directory deletion.
- Changes to session execution, model/provider routing, or tool execution.
- Replacing the existing workflow shell or status projection.
