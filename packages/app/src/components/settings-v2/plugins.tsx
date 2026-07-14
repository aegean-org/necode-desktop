import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePluginSettings } from "./plugin-controller"
import { PluginRow } from "./plugin-row"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"
import "./plugin.css"

type Controller = ReturnType<typeof usePluginSettings>
type SectionProps = Pick<Controller, "management" | "openDetail" | "openRemove"> & {
  title: string
  entries: readonly PluginEntry[]
}

/** Renders the project-scoped desktop plugin management center. */
export function SettingsPluginsV2() {
  const controller = usePluginSettings()
  return (
    <>
      <PluginHeader controller={controller} />
      <PluginBody controller={controller} />
    </>
  )
}

function PluginHeader(props: { controller: Controller }) {
  return (
    <div class="settings-v2-tab-header settings-v2-tab-header--stacked settings-v2-plugin-header">
      <div class="settings-v2-tab-header-row">
        <h2 class="settings-v2-tab-title">{props.controller.language.t("settings.plugins.title")}</h2>
        <ButtonV2
          variant="ghost-muted"
          icon="plus"
          disabled={!props.controller.desktop() || !props.controller.directory()}
          onClick={props.controller.openInstall}
        >
          {props.controller.language.t("settings.plugins.action.install")}
        </ButtonV2>
      </div>
      <div class="settings-v2-tab-search">
        <TextInputV2
          type="search"
          value={props.controller.filter()}
          onInput={(event) => props.controller.setFilter(event.currentTarget.value)}
          placeholder={props.controller.language.t("settings.plugins.search.placeholder")}
          aria-label={props.controller.language.t("settings.plugins.search.placeholder")}
        />
        <Show when={props.controller.filter()}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            class="settings-v2-tab-search-clear"
            icon={<Icon name="close" />}
            onClick={() => props.controller.setFilter("")}
          />
        </Show>
      </div>
    </div>
  )
}

function PluginBody(props: { controller: Controller }) {
  const empty = () => Object.values(props.controller.entries()).every((entries) => entries.length === 0)
  const error = () => props.controller.status.error ?? props.controller.config.error
  return (
    <div class="settings-v2-tab-body settings-v2-plugins">
      <SettingsListV2>
        <Show when={props.controller.desktop()} fallback={<PluginStatus text="settings.plugins.desktopOnly" />}>
          <Show when={props.controller.directory()} fallback={<PluginStatus text="settings.plugins.noProject" />}>
            <Show
              when={!props.controller.status.isLoading && !props.controller.config.isLoading}
              fallback={<PluginStatus text="common.loading" />}
            >
              <Show when={!error()} fallback={<PluginQueryError error={error()} />}>
                <Show when={!empty()} fallback={<PluginStatus text="settings.plugins.empty" />}>
                  <PluginSection
                    title={props.controller.language.t("settings.plugins.section.builtin")}
                    entries={props.controller.entries().builtin}
                    management={props.controller.management}
                    openDetail={props.controller.openDetail}
                    openRemove={props.controller.openRemove}
                  />
                  <PluginSection
                    title={props.controller.language.t("settings.plugins.section.installed")}
                    entries={props.controller.entries().installed}
                    management={props.controller.management}
                    openDetail={props.controller.openDetail}
                    openRemove={props.controller.openRemove}
                  />
                  <SystemSection controller={props.controller} />
                </Show>
              </Show>
            </Show>
          </Show>
        </Show>
      </SettingsListV2>
    </div>
  )
}

function PluginSection(props: SectionProps) {
  return (
    <Show when={props.entries.length > 0}>
      <section class="settings-v2-plugin-section">
        <h3>{props.title}</h3>
        <For each={props.entries}>
          {(entry) => (
            <PluginRow
              entry={entry}
              pending={props.management.toggle.isPending && props.management.toggle.variables?.entry.key === entry.key}
              onOpen={props.openDetail}
              onToggle={(item, enabled) => props.management.toggle.mutate({ entry: item, enabled })}
              onRemove={props.openRemove}
            />
          )}
        </For>
      </section>
    </Show>
  )
}

function SystemSection(props: { controller: Controller }) {
  const [expanded, setExpanded] = createSignal(false)
  return (
    <Show when={props.controller.entries().system.length > 0}>
      <section class="settings-v2-plugin-section settings-v2-plugin-system">
        <button type="button" class="settings-v2-plugin-system-toggle" onClick={() => setExpanded(!expanded())}>
          <span>{props.controller.language.t("settings.plugins.section.system")}</span>
          <span>{props.controller.entries().system.length}</span>
          <Icon name={expanded() ? "outline-chevron-down" : "arrow-right"} />
        </button>
        <Show when={expanded()}>
          <For each={props.controller.entries().system}>
            {(entry) => <PluginRow entry={entry} pending={false} readonly onOpen={props.controller.openDetail} />}
          </For>
        </Show>
      </section>
    </Show>
  )
}

function PluginStatus(props: { text: string }) {
  const language = useLanguage()
  return <div class="settings-v2-plugin-status">{language.t(props.text)}</div>
}

function PluginQueryError(props: { error: unknown }) {
  const message = () => (props.error instanceof Error ? props.error.message : String(props.error))
  return <div class="settings-v2-plugin-status settings-v2-plugin-status--error">{message()}</div>
}
