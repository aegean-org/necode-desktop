import type { McpStatus } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { For, type JSX, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { mcpDisplayItems, statusLabelKey } from "../ne-mcp"
import { useMcpSettings } from "./mcp-controller"
import type { McpManagementRow } from "./mcp-model"
import { McpRowMenu } from "./mcp-row-menu"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"

type McpItem = ReturnType<typeof mcpDisplayItems>[number]
type Translate = ReturnType<typeof useLanguage>["t"]

/** Renders MCP runtime status and desktop-only persistent configuration management. */
export function SettingsMcpV2() {
  const controller = useMcpSettings()
  return (
    <>
      <McpHeader desktop={controller.desktop()} onAdd={controller.openAdd} />
      <Show
        when={controller.desktop()}
        fallback={
          <McpBody
            directory={controller.directory()}
            loading={controller.status.isLoading}
            empty={Object.keys(controller.status.data ?? {}).length === 0}
          >
            <For each={mcpDisplayItems(controller.status.data ?? {})}>
              {(item) => (
                <LegacyRow
                  item={item}
                  pending={controller.toggle.isPending && controller.toggle.variables?.name === item.name}
                  t={controller.language.t}
                  onToggle={() => controller.toggle.mutate(item)}
                />
              )}
            </For>
          </McpBody>
        }
      >
        <McpBody
          directory={controller.directory()}
          loading={controller.status.isLoading || controller.config.isLoading}
          empty={controller.rows().length === 0}
        >
          <For each={controller.rows()}>
            {(entry) => (
              <ManagementRow
                entry={entry}
                pending={controller.toggle.isPending && controller.toggle.variables?.name === entry.name}
                t={controller.language.t}
                onToggle={() => controller.toggle.mutate(entry)}
                onEdit={controller.openEdit}
                onRemove={controller.openRemove}
              />
            )}
          </For>
        </McpBody>
      </Show>
    </>
  )
}

function McpHeader(props: { desktop: boolean; onAdd: () => void }) {
  const language = useLanguage()
  return (
    <div class="settings-v2-tab-header settings-v2-mcp-header">
      <div class="settings-v2-tab-header-row">
        <h2 class="settings-v2-tab-title">{language.t("settings.mcp.title")}</h2>
        <Show when={props.desktop}>
          <ButtonV2 data-action="mcp-add" variant="ghost-muted" icon="plus" onClick={props.onAdd}>
            {language.t("settings.mcp.action.add")}
          </ButtonV2>
        </Show>
      </div>
    </div>
  )
}

function McpBody(props: { directory?: string; loading: boolean; empty: boolean; children: JSX.Element }) {
  return (
    <div class="settings-v2-tab-body settings-v2-mcp">
      <SettingsListV2>
        <Show when={props.directory} fallback={<McpStatus text="settings.mcp.noProject" />}>
          <Show when={!props.loading} fallback={<McpStatus text="common.loading" loading />}>
            <Show when={!props.empty} fallback={<McpStatus text="dialog.mcp.empty" />}>
              {props.children}
            </Show>
          </Show>
        </Show>
      </SettingsListV2>
    </div>
  )
}

function McpStatus(props: { text: string; loading?: boolean }) {
  const language = useLanguage()
  return (
    <div class="settings-v2-mcp-status">
      {language.t(props.text)}
      <Show when={props.loading}>{language.t("common.loading.ellipsis")}</Show>
    </div>
  )
}

function ManagementRow(props: {
  entry: McpManagementRow
  pending: boolean
  t: Translate
  onToggle: () => void
  onEdit: (entry: McpManagementRow) => void
  onRemove: (entry: McpManagementRow) => void
}) {
  return (
    <div class="settings-v2-mcp-row">
      <McpLead
        name={props.entry.displayName}
        status={props.entry.status}
        error={props.entry.error}
        meta={props.entry.overriddenBy ? props.t(`settings.mcp.overridden.${props.entry.overriddenBy}`) : undefined}
        t={props.t}
      />
      <div class="settings-v2-mcp-actions">
        <Tag>{props.t(`settings.mcp.scope.${props.entry.scope}`)}</Tag>
        <Show when={props.entry.canToggle}>
          <RuntimeControl item={props.entry} pending={props.pending} t={props.t} onToggle={props.onToggle} />
        </Show>
        <McpRowMenu entry={props.entry} onEdit={props.onEdit} onRemove={props.onRemove} />
      </div>
    </div>
  )
}

function LegacyRow(props: { item: McpItem; pending: boolean; t: Translate; onToggle: () => void }) {
  return (
    <div class="settings-v2-mcp-row">
      <McpLead name={props.item.displayName} status={props.item.status} error={props.item.error} t={props.t} />
      <RuntimeControl item={props.item} pending={props.pending} t={props.t} onToggle={props.onToggle} />
    </div>
  )
}

function McpLead(props: { name: string; status?: McpStatus["status"]; error?: string; meta?: string; t: Translate }) {
  const label = () => statusLabelKey(props.status)
  return (
    <div class="settings-v2-mcp-lead">
      <div class={statusDotClass(props.status)} />
      <div class="settings-v2-mcp-copy">
        <div class="settings-v2-mcp-main">
          <span class="settings-v2-mcp-name truncate">{props.name}</span>
          <Show when={label()}>{(key) => <span class="settings-v2-mcp-status-label">{props.t(key())}</span>}</Show>
        </div>
        <Show when={props.meta}>{(meta) => <p class="settings-v2-mcp-description">{meta()}</p>}</Show>
        <Show when={props.error}>{(error) => <p class="settings-v2-mcp-description">{error()}</p>}</Show>
      </div>
    </div>
  )
}

function RuntimeControl(props: {
  item: { name: string; displayName: string; status?: McpStatus["status"] }
  pending: boolean
  t: Translate
  onToggle: () => void
}) {
  return (
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
  )
}

function statusDotClass(status?: McpStatus["status"]) {
  return [
    "settings-v2-mcp-dot",
    status === "connected" ? "settings-v2-mcp-dot--success" : "",
    status === "failed" ? "settings-v2-mcp-dot--critical" : "",
    status === "disabled" || !status ? "settings-v2-mcp-dot--muted" : "",
    status === "needs_auth" || status === "needs_client_registration" ? "settings-v2-mcp-dot--warning" : "",
  ].join(" ")
}
