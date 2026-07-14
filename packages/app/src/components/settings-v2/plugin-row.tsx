import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { pluginStatusLabel } from "./plugin-model"
import "./plugin.css"

type RowProps = {
  entry: PluginEntry
  pending: boolean
  readonly?: boolean
  onOpen: (entry: PluginEntry) => void
  onToggle?: (entry: PluginEntry, enabled: boolean) => void
  onRemove?: (entry: PluginEntry) => void
}

/** Renders one clickable plugin row with isolated management controls. */
export function PluginRow(props: RowProps) {
  const openFromKeyboard = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    props.onOpen(props.entry)
  }
  return (
    <div
      class="settings-v2-plugin-row"
      classList={{ "settings-v2-plugin-row--failed": props.entry.status === "failed" }}
      role="button"
      tabIndex={0}
      onClick={() => props.onOpen(props.entry)}
      onKeyDown={openFromKeyboard}
    >
      <PluginLead entry={props.entry} />
      <Show when={!props.readonly}>
        <div
          class="settings-v2-plugin-actions"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Show when={props.entry.canDisable}>
            <Switch
              checked={props.entry.enabled}
              disabled={props.pending || !props.entry.canDisable}
              onChange={(enabled) => requireToggle(props.onToggle)(props.entry, enabled)}
              hideLabel
            >
              {props.entry.name}
            </Switch>
          </Show>
          <Show when={props.entry.canUninstall && props.onRemove}>
            {(onRemove) => <PluginRowMenu entry={props.entry} onRemove={onRemove()} />}
          </Show>
        </div>
      </Show>
    </div>
  )
}

function PluginLead(props: { entry: PluginEntry }) {
  const language = useLanguage()
  return (
    <div class="settings-v2-plugin-lead">
      <div class={statusDotClass(props.entry.status)} />
      <div class="settings-v2-plugin-copy">
        <div class="settings-v2-plugin-main">
          <span class="settings-v2-plugin-name">{props.entry.name}</span>
          <Tag>{language.t(pluginStatusLabel(props.entry.status))}</Tag>
          <Show when={props.entry.scope !== "builtin"}>
            <Tag>{language.t(`settings.plugins.scope.${props.entry.scope}`)}</Tag>
          </Show>
        </div>
        <Show when={props.entry.description}>
          {(description) => <p class="settings-v2-plugin-description">{description()}</p>}
        </Show>
        <Show when={props.entry.error}>
          {(error) => (
            <p class="settings-v2-plugin-error-copy">
              {error().stage}: {error().message}
            </p>
          )}
        </Show>
      </div>
    </div>
  )
}

function PluginRowMenu(props: { entry: PluginEntry; onRemove: (entry: PluginEntry) => void }) {
  const language = useLanguage()
  return (
    <MenuV2 gutter={4} modal={false} placement="bottom-end">
      <MenuV2.Trigger
        as={IconButtonV2}
        variant="ghost-muted"
        size="small"
        icon={<Icon name="outline-dots" />}
        aria-label={language.t("common.moreOptions")}
      />
      <MenuV2.Portal>
        <MenuV2.Content>
          <MenuV2.Item onSelect={() => props.onRemove(props.entry)}>
            {language.t("settings.plugins.action.remove")}
          </MenuV2.Item>
        </MenuV2.Content>
      </MenuV2.Portal>
    </MenuV2>
  )
}

function statusDotClass(status: PluginEntry["status"]) {
  return [
    "settings-v2-plugin-dot",
    status === "active" ? "settings-v2-plugin-dot--success" : "",
    status === "failed" || status === "incompatible" ? "settings-v2-plugin-dot--critical" : "",
    status === "disabled" ? "settings-v2-plugin-dot--muted" : "",
  ].join(" ")
}

function requireToggle(toggle: RowProps["onToggle"]) {
  if (!toggle) throw new Error("Plugin toggle callback is required for writable rows")
  return toggle
}
