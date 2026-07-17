import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { createMemo, createSignal, type Accessor } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { DialogPluginDetail } from "./dialog-plugin-detail"
import { DialogPluginInstall, type PluginInstallResult } from "./dialog-plugin-install"
import { DialogPluginRemove } from "./dialog-plugin-remove"
import { pluginClient } from "./plugin-client"
import { pluginSections } from "./plugin-model"

type Translate = ReturnType<typeof useLanguage>["t"]
type Client = ReturnType<typeof pluginClient>

/** Owns desktop plugin registry queries, mutations, search, and dialogs. */
export function usePluginSettings() {
  const language = useLanguage()
  const dialog = useDialog()
  const platform = usePlatform()
  const server = useServer()
  const serverSDK = useServerSDK()
  const [filter, setFilter] = createSignal("")
  const directory = createMemo(() => server.projects.last() ?? server.projects.list()[0]?.worktree)
  const desktop = () => platform.platform === "desktop"
  const client = () => pluginClient(requireDirectory(directory()), serverSDK())
  const status = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "plugins"] as const,
    enabled: desktop() && !!directory(),
    queryFn: () => client().list(),
  }))
  const config = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "plugin-config"] as const,
    enabled: desktop() && !!directory(),
    queryFn: () => client().config(),
  }))
  const refresh = async () => {
    await Promise.all([status.refetch(), config.refetch()])
  }
  const management = createPluginMutations(client, refresh, language.t)
  const entries = createMemo(() => pluginSections(status.data ?? [], filter()))
  return {
    language,
    desktop,
    directory,
    filter,
    setFilter,
    status,
    config,
    entries,
    management,
    ...createDialogActions({ dialog, management }),
  }
}

function createPluginMutations(client: () => Client, refresh: () => Promise<void>, t: Translate) {
  const options = { onError: (error: unknown) => requestFailed(error, t) }
  const install = useMutation(() => ({
    ...options,
    mutationFn: async (input: PluginInstallResult) => {
      await client().install(input.spec, input.scope)
      await refresh()
    },
  }))
  const toggle = async (input: { entry: PluginEntry; enabled: boolean }) => {
    try {
      await client().setEnabled(input.entry.key, input.enabled)
      await refresh()
    } catch (error) {
      requestFailed(error, t)
    }
  }
  const remove = useMutation(() => ({
    ...options,
    mutationFn: async (entry: PluginEntry) => {
      await client().remove(entry.key)
      await refresh()
    },
  }))
  return { install, toggle, remove }
}

function createDialogActions(input: {
  dialog: ReturnType<typeof useDialog>
  management: ReturnType<typeof createPluginMutations>
}) {
  const openInstall = () =>
    input.dialog.push(() => <DialogPluginInstall onSubmit={input.management.install.mutateAsync} />)
  const openDetail = (entry: PluginEntry) => input.dialog.push(() => <DialogPluginDetail entry={entry} />)
  const openRemove = (entry: PluginEntry) => {
    if (!entry.canUninstall) throw new Error(`Plugin cannot be removed: ${entry.key}`)
    input.dialog.push(() => (
      <DialogPluginRemove entry={entry} onConfirm={() => input.management.remove.mutateAsync(entry)} />
    ))
  }
  return { openInstall, openDetail, openRemove }
}

function requireDirectory(directory: string | undefined) {
  if (!directory) throw new Error("No project directory available for plugin management")
  return directory
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
