import type { McpConfigEntry, McpStatus } from "@opencode-ai/sdk/v2/client"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { createMemo, type Accessor } from "solid-js"
import { toggleMcp } from "@/context/global-sync/mcp"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { DialogMcpRemove } from "./dialog-mcp-remove"
import { DialogMcp } from "./dialog-mcp"
import type { McpFormResult } from "./mcp-form"
import { mcpManagementRows, type McpManagementRow } from "./mcp-model"

type Translate = ReturnType<typeof useLanguage>["t"]

/** Owns desktop MCP queries, mutations, runtime toggles, and dialogs. */
export function useMcpSettings() {
  const language = useLanguage()
  const dialog = useDialog()
  const platform = usePlatform()
  const server = useServer()
  const serverSDK = useServerSDK()
  const directory = createMemo(() => server.projects.last() ?? server.projects.list()[0]?.worktree)
  const desktop = () => platform.platform === "desktop"
  const client = () => mcpClient(directory, serverSDK)
  const status = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "mcp"] as const,
    enabled: !!directory(),
    queryFn: () =>
      client()
        .mcp.status()
        .then((result) => result.data ?? {}),
  }))
  const config = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "mcp-config"] as const,
    enabled: desktop() && !!directory(),
    queryFn: () =>
      client()
        .mcp.config.list()
        .then((result) => result.data ?? []),
  }))
  const rows = createMemo(() => mcpManagementRows(config.data ?? [], status.data ?? {}))
  const refresh = async () => {
    await config.refetch()
    await status.refetch()
  }
  const management = createManagementMutations(client, refresh, language.t)
  const toggle = createToggleMutation(client, status.refetch, language.t)
  const entries = () => config.data ?? []
  return {
    language,
    directory,
    desktop,
    status,
    config,
    rows,
    toggle,
    ...createDialogActions({ dialog, entries, management }),
  }
}

function createDialogActions(options: {
  dialog: ReturnType<typeof useDialog>
  entries: Accessor<McpConfigEntry[]>
  management: ReturnType<typeof createManagementMutations>
}) {
  const openAdd = () =>
    options.dialog.push(() => (
      <DialogMcp
        existingNames={options.entries().map((entry) => entry.name)}
        onSubmit={options.management.create.mutateAsync}
      />
    ))
  const openEdit = (row: McpManagementRow) => {
    const entry = requireEntry(options.entries(), row.id)
    options.dialog.push(() => (
      <DialogMcp
        entry={entry}
        existingNames={options.entries().map((item) => item.name)}
        onSubmit={(payload) => options.management.update.mutateAsync({ entry, payload })}
      />
    ))
  }
  const openRemove = (row: McpManagementRow) => {
    const entry = requireEntry(options.entries(), row.id)
    options.dialog.push(() => (
      <DialogMcpRemove entry={entry} onConfirm={() => options.management.remove.mutateAsync(entry)} />
    ))
  }
  return { openAdd, openEdit, openRemove }
}

function createManagementMutations(
  client: () => ReturnType<typeof mcpClient>,
  refresh: () => Promise<void>,
  t: Translate,
) {
  const options = { onError: (error: unknown) => requestFailed(error, t) }
  const create = useMutation(() => ({
    ...options,
    mutationFn: async (payload: McpFormResult) => {
      await client().mcp.config.create({ scope: payload.scope, name: payload.name, config: payload.config })
      await refresh()
    },
  }))
  const update = useMutation(() => ({
    ...options,
    mutationFn: async ({ entry, payload }: { entry: McpConfigEntry; payload: McpFormResult }) => {
      await client().mcp.config.update({ entryID: entry.id, name: payload.name, config: payload.config })
      await refresh()
    },
  }))
  const remove = useMutation(() => ({
    ...options,
    mutationFn: async (entry: McpConfigEntry) => {
      await client().mcp.config.remove({ entryID: entry.id })
      await refresh()
    },
  }))
  return { create, update, remove }
}

function createToggleMutation(
  client: () => ReturnType<typeof mcpClient>,
  refetch: () => Promise<unknown>,
  t: Translate,
) {
  return useMutation(() => ({
    mutationFn: (item: { name: string; status?: McpStatus["status"] }) =>
      toggleMcp({
        status: requireStatus(item),
        connect: () =>
          client()
            .mcp.connect({ name: item.name })
            .then(() => undefined),
        disconnect: () =>
          client()
            .mcp.disconnect({ name: item.name })
            .then(() => undefined),
        authenticate: () =>
          client()
            .mcp.auth.authenticate({ name: item.name })
            .then(() => undefined),
        refresh: () => refetch().then(() => undefined),
      }),
    onError: (error) => requestFailed(error, t),
  }))
}

function mcpClient(directory: Accessor<string | undefined>, serverSDK: ReturnType<typeof useServerSDK>) {
  const current = directory()
  if (!current) throw new Error("No project directory available for MCP")
  return serverSDK().createClient({ directory: current, throwOnError: true })
}

function requireEntry(entries: readonly McpConfigEntry[], id: string) {
  const entry = entries.find((item) => item.id === id)
  if (!entry) throw new Error(`MCP configuration entry not found: ${id}`)
  return entry
}

function requireStatus(item: { name: string; status?: McpStatus["status"] }) {
  if (!item.status) throw new Error(`MCP runtime status not found: ${item.name}`)
  return item.status
}

function requestFailed(error: unknown, t: Translate) {
  const description =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : String(error)
  showToast({ variant: "error", title: t("common.requestFailed"), description })
}
