import type { McpStatus } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { type Accessor, createMemo, For, Show } from "solid-js"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { toggleMcp } from "@/context/global-sync/mcp"
import { showToast } from "@/utils/toast"
import { mcpDisplayItems } from "../ne-mcp"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"

type McpItem = ReturnType<typeof mcpDisplayItems>[number]
type Translate = (key: string) => string

/**
 * Renders the project-scoped MCP management tab for Settings v2.
 */
export function SettingsMcpV2() {
  const language = useLanguage()
  const server = useServer()
  const serverSDK = useServerSDK()
  const directory = createMemo(() => server.projects.last() ?? server.projects.list()[0]?.worktree)
  const status = useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "settings", "mcp"] as const,
    enabled: !!directory(),
    queryFn: () => mcpClient(directory, serverSDK).mcp.status().then((result) => result.data ?? {}),
  }))
  const items = createMemo(() => mcpDisplayItems(status.data ?? {}))
  const toggle = useMutation(() => ({
    mutationFn: (item: McpItem) =>
      toggleMcp({
        status: item.status,
        connect: () => mcpClient(directory, serverSDK).mcp.connect({ name: item.name }).then(() => undefined),
        disconnect: () => mcpClient(directory, serverSDK).mcp.disconnect({ name: item.name }).then(() => undefined),
        authenticate: () =>
          mcpClient(directory, serverSDK).mcp.auth.authenticate({ name: item.name }).then(() => undefined),
        refresh: () => status.refetch().then(() => undefined),
      }),
    onError: (error) => {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    },
  }))

  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.mcp.title")}</h2>
      </div>

      <SettingsMcpBody
        directory={directory()}
        items={items()}
        loading={status.isLoading}
        pending={toggle.isPending}
        pendingName={toggle.variables?.name}
        t={language.t}
        onToggle={(item) => toggle.mutate(item)}
      />
    </>
  )
}

function SettingsMcpBody(props: {
  directory?: string
  items: McpItem[]
  loading: boolean
  pending: boolean
  pendingName?: string
  t: Translate
  onToggle: (item: McpItem) => void
}) {
  return (
    <div class="settings-v2-tab-body settings-v2-mcp">
      <SettingsListV2>
        <Show
          when={props.directory}
          fallback={<div class="settings-v2-mcp-status">{props.t("settings.mcp.noProject")}</div>}
        >
          <Show
            when={!props.loading}
            fallback={
              <div class="settings-v2-mcp-status">
                {props.t("common.loading")}
                {props.t("common.loading.ellipsis")}
              </div>
            }
          >
            <Show
              when={props.items.length > 0}
              fallback={<div class="settings-v2-mcp-status">{props.t("dialog.mcp.empty")}</div>}
            >
              <For each={props.items}>
                {(item) => (
                  <SettingsMcpRow
                    item={item}
                    pending={props.pendingName === item.name && props.pending}
                    t={props.t}
                    onToggle={() => props.onToggle(item)}
                  />
                )}
              </For>
            </Show>
          </Show>
        </Show>
      </SettingsListV2>
    </div>
  )
}

function mcpClient(directory: Accessor<string | undefined>, serverSDK: ReturnType<typeof useServerSDK>) {
  const current = directory()
  if (!current) throw new Error("No project directory available for MCP status")
  return serverSDK().createClient({ directory: current, throwOnError: true })
}

function SettingsMcpRow(props: { item: McpItem; pending: boolean; t: Translate; onToggle: () => void }) {
  const statusText = () => (props.item.statusLabelKey ? props.t(props.item.statusLabelKey) : props.item.status)
  return (
    <div class="settings-v2-mcp-row">
      <div class="settings-v2-mcp-lead">
        <div class={statusDotClass(props.item.status)} />
        <div class="settings-v2-mcp-copy">
          <div class="settings-v2-mcp-main">
            <span class="settings-v2-mcp-name truncate">{props.item.displayName}</span>
            <span class="settings-v2-mcp-status-label">{statusText()}</span>
          </div>
          <Show when={props.item.error}>
            {(error) => <p class="settings-v2-mcp-description">{error()}</p>}
          </Show>
        </div>
      </div>
      <Show
        when={props.item.status === "needs_auth"}
        fallback={
          <Switch
            checked={props.item.status === "connected"}
            disabled={props.pending}
            onChange={props.onToggle}
            hideLabel
          >
            {props.item.displayName}
          </Switch>
        }
      >
        <ButtonV2 size="normal" variant="neutral" disabled={props.pending} onClick={props.onToggle}>
          {props.t("mcp.auth.clickToAuthenticate")}
        </ButtonV2>
      </Show>
    </div>
  )
}

function statusDotClass(status: McpStatus["status"]) {
  return [
    "settings-v2-mcp-dot",
    status === "connected" ? "settings-v2-mcp-dot--success" : "",
    status === "failed" ? "settings-v2-mcp-dot--critical" : "",
    status === "disabled" ? "settings-v2-mcp-dot--muted" : "",
    status === "needs_auth" || status === "needs_client_registration" ? "settings-v2-mcp-dot--warning" : "",
  ].join(" ")
}
