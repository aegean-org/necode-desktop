# Custom MCP Management Design

## Objective

Add complete custom MCP management to NeCode Settings so users can persist local-command and remote MCP servers at either the current-project or global scope. The existing NoteExpress and Qingti Base integrations remain product-managed and read-only. Connection, disconnection, and OAuth authentication continue to expose real runtime failures.

## Current State

- Settings v2 reads `/mcp` runtime status and can connect, disconnect, or authenticate configured servers.
- The runtime supports local commands, working directories, environment variables, remote URLs, headers, OAuth, request timeouts, and startup enablement.
- `POST /mcp` calls `MCP.add`, which mutates only the current instance state. The entry disappears after restart.
- The CLI already writes MCP entries with `jsonc-parser`, but that path is embedded in the interactive command and only supports creation.
- Project configuration is loaded from `opencode.json` / `opencode.jsonc` discovery paths. The generic project `Config.update` writes `config.json`, so it is not a valid persistence boundary for this feature.
- NoteExpress and Qingti Base are injected by the NeCode plugin and are currently distinguished only by app-side display metadata.

## Product Decisions

### Settings layout

The MCP tab header includes an `Add MCP` action. The list keeps product-managed integrations first, followed by user-defined entries sorted by display name.

Each row shows:

- display name;
- scope badge: `Current project`, `Global`, or `Built in`;
- connection status and an explicit error message when present;
- connect/disconnect switch or OAuth authenticate action;
- an overflow menu for editable custom entries.

The overflow menu contains `Edit` and `Remove`. Removal requires confirmation and identifies the scope being changed. Built-in rows never expose edit or remove actions, but they retain connection and authentication controls.

### Add and edit dialog

The dialog uses Settings v2 controls and contains a type selector with `Local command` and `Remote URL`.

Common fields:

- name;
- scope, selectable when creating and read-only when editing;
- request timeout in milliseconds;
- enabled on startup.

Local fields:

- command as an argument list, not a shell string;
- optional working directory;
- repeatable environment variable key/value rows.

Remote fields:

- URL;
- repeatable HTTP header key/value rows;
- OAuth mode: automatic detection, explicit configuration, or disabled;
- optional OAuth client ID, client secret, scope, callback port, and redirect URI when explicit configuration is selected.

Edit loads the exact persisted configuration represented by the selected row. Changing type replaces fields belonging only to the previous type after confirmation in the dialog. Secrets are not logged or included in toast text.

### Names and scope

MCP names use the same portable identifier rule as other user-configured integrations: lowercase letters, digits, hyphens, and underscores, beginning with a letter or digit.

`noteexpress` and `qingtibase` are reserved product IDs. Create, rename, update, and remove requests targeting either ID fail with an explicit validation error, even if a user has manually placed such an entry in a configuration file. Manually configured reserved entries remain loadable but are displayed as read-only product entries.

Creating a name that already exists in any discovered file for the selected scope fails. A project entry may share a name with a global entry because project configuration has higher precedence. When this occurs, both configurations remain visible:

- the project row is marked effective and owns runtime connection controls;
- the global row is marked `Overridden by project` and keeps edit/remove actions but has no connection control.

Editing cannot move an entry between scopes. Moving is an explicit remove-and-create operation, which avoids a partially completed two-file mutation.

## Architecture

### Persistent configuration service

Create a focused MCP configuration service in the runtime. It owns:

- resolving the global and current-project MCP config files;
- reading the `mcp` object from each file independently;
- validating names and MCP schemas;
- creating, updating, renaming, and removing one scoped entry;
- preserving JSONC comments and unrelated formatting with `jsonc-parser` edits;
- assigning an opaque entry ID to each discovered source/name pair;
- returning scope, source path, effective state, and read-only metadata.

The CLI MCP command delegates its config-file resolution and write behavior to this service instead of maintaining a second persistence implementation.

The service discovers every supported global and current-project config source that contributes MCP configuration. Existing entries are edited or removed from their exact source file through the opaque entry ID; the API never accepts an arbitrary filesystem path from the client.

Create-target selection is deterministic:

- global scope writes the highest-precedence existing global `opencode.jsonc` / `opencode.json` file and creates `<global-config>/opencode.json` when neither exists;
- project scope writes the highest-precedence existing `opencode.jsonc` / `opencode.json` source inside the current worktree and creates `<worktree>/opencode.json` when none exists;
- the service never writes project MCP data to `config.json`.

Malformed JSONC, schema errors, inaccessible paths, and write failures fail the request. No in-memory-only fallback is allowed.

### HTTP API

Add typed persistent-management endpoints beside the existing runtime MCP endpoints:

- `GET /mcp/config`: list built-in and scoped custom entries with source/effective metadata;
- `POST /mcp/config`: create one scoped entry;
- `PUT /mcp/config/:entryID`: update or rename the exact persisted entry within its existing scope;
- `DELETE /mcp/config/:entryID`: remove the exact persisted entry.

Mutation payloads use the existing v1 MCP config schema used by `/mcp`, including camelCase OAuth fields. Scope is an explicit `project | global` value. Responses return the refreshed configuration list rather than an optimistic echo.

The existing `POST /mcp` remains a runtime-only API and is not used by Settings. Its documentation must continue to describe its non-persistent behavior so callers cannot mistake it for saved configuration.

### Instance refresh

After a successful disk mutation, the handler marks the current instance for disposal using the existing configuration-update lifecycle. The response is produced from the persisted file state; the next instance-bound request rebuilds Config and MCP services from disk.

The app then invalidates both MCP configuration and status queries. It does not call `MCP.add` as a fallback. Consequently:

- a newly enabled entry is connected by the reloaded runtime;
- a disabled entry returns as disabled;
- an edited or removed entry cannot leave a stale MCP client behind;
- a persistence failure leaves the current runtime untouched and visibly fails.

### App model

Add an app-side MCP management model that joins configuration entries with the runtime status map by effective server name. It owns:

- built-in ordering and display names;
- row identity from the server-provided opaque entry ID;
- effective/overridden state;
- form-to-API payload conversion;
- validation errors for name, URL, command arguments, key/value rows, timeout, callback port, and redirect URI.

The Settings component renders this model and keeps network mutations in focused query/mutation handlers. Form validation is pure and covered independently from dialog rendering.

## Data Flow

### Load

1. Settings requests `/mcp/config` and `/mcp` for the active project directory.
2. The server reads project and global files separately, adds built-in metadata, and calculates precedence.
3. The app joins effective entries with runtime status and renders overridden entries without runtime controls.

### Create or edit

1. The dialog validates and submits the explicit scope and MCP configuration.
2. The server validates the target file and applies JSONC edits.
3. The server marks the current instance for disposal and returns the persisted configuration list.
4. The app closes the dialog only after success, invalidates config/status queries, and renders the rebuilt state.

### Remove

1. The user confirms the scoped entry removal.
2. The server removes only `mcp.<name>` from that scope's file.
3. Empty parent `mcp` objects are removed; unrelated configuration and comments remain.
4. The instance is refreshed and the app reloads configuration and status.

## Validation and Error Handling

- Names are trimmed for validation and storage; uppercase input is rejected rather than silently lowercased.
- Commands require at least one non-empty argument. Arguments are stored exactly as separate array values and are never shell-split by the server.
- URLs and redirect URIs must be valid HTTP or HTTPS URLs.
- Environment/header keys must be non-empty and unique case-insensitively within their list; a value may be empty only when the underlying MCP schema permits an intentional empty string.
- Timeout must be a positive integer. Callback port must be an integer from 1 through 65535.
- OAuth disabled persists `oauth: false`; automatic detection omits `oauth`; explicit mode persists an OAuth object, including an empty object when dynamic client registration is desired.
- API failures use typed bad-request/not-found/conflict errors with a user-readable message.
- The app shows error toasts and keeps the dialog or confirmation open after failure.
- No errors are swallowed, replaced with mock success, or converted to local-only state.

## Accessibility

- Add, edit, remove, authenticate, and connection controls have translated accessible labels.
- Overflow menus are keyboard reachable and visible on focus, not hover only.
- Dynamic key/value rows expose labelled add/remove controls.
- Validation errors are associated with their input and remain visible until corrected.
- Password inputs are used for OAuth client secrets.

## Testing

### Runtime

- Resolve existing and default project/global config paths correctly.
- Preserve JSONC comments while creating, updating, renaming, and removing entries.
- Never write project MCP configuration to `config.json`.
- Reject reserved names, duplicates in the same scope, malformed JSONC, invalid schemas, and missing entries.
- Represent project/global duplicates with correct effective metadata.
- Mark the instance for disposal only after a successful write.
- Keep `POST /mcp` explicitly runtime-only.
- Verify the CLI delegates persistent writes to the shared service.

### App

- Join effective config entries with status and leave overridden rows without connection controls.
- Keep NoteExpress and Qingti Base first and read-only.
- Validate local, remote, key/value, OAuth, timeout, and callback-port fields.
- Serialize all three OAuth modes correctly.
- Submit explicit scope for create/update/remove and show mutation failures.
- Render add, edit, remove-confirmation, authentication, and disabled states with accessible labels.

### Verification

- Run focused Bun tests from `packages/opencode` and `packages/app`, with backend test commands limited to 60 seconds.
- Regenerate the JavaScript SDK with `packages/sdk/js/script/build.ts` after API changes.
- Run `bun typecheck` from each affected package.
- Run the app production build.
- In the current NeCode DEV desktop window, create one project-local command MCP and one global remote MCP, restart NeCode, and verify both persist.
- Verify edit, remove, enable/disable, headers, environment variables, OAuth authentication, built-in read-only behavior, project/global override presentation, and visible failure handling.

## Non-Goals

- A public MCP catalog or one-click marketplace installation.
- Import/export bundles or bulk MCP editing.
- Secret-manager integration beyond the existing configuration-file model.
- Moving entries between scopes in one mutation.
- Editing product-managed NoteExpress or Qingti Base definitions.
- Hiding connection, authentication, process, schema, or persistence failures.
