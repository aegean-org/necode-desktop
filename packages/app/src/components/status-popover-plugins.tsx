import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { For, Show } from "solid-js"
import { pluginStatusLabel } from "./settings-v2/plugin-model"
import { pluginStatusClass } from "./plugin-status-query"

type Translate = (key: string) => string

/** Renders real plugin registry state inside the status popover. */
export function StatusPopoverPlugins(props: {
  plugins: readonly PluginEntry[]
  loading: boolean
  error: unknown
  onManage: () => void
  t: Translate
}) {
  return (
    <div class="flex flex-col px-2 pb-2">
      <div class="flex flex-col p-3 bg-background-base rounded-sm min-h-14">
        <Show when={!props.loading} fallback={<PluginMessage>{props.t("common.loading")}</PluginMessage>}>
          <Show when={!props.error} fallback={<PluginMessage critical>{errorMessage(props.error)}</PluginMessage>}>
            <Show
              when={props.plugins.length > 0}
              fallback={<PluginMessage>{props.t("status.popover.plugins.empty")}</PluginMessage>}
            >
              <For each={props.plugins}>
                {(plugin) => (
                  <div class="flex items-center gap-2 w-full px-2 py-1">
                    <div class={`size-1.5 rounded-full shrink-0 ${pluginStatusClass(plugin.status)}`} />
                    <span class="text-14-regular text-text-base truncate flex-1">{plugin.name}</span>
                    <span class="text-11-regular text-text-weak">{props.t(pluginStatusLabel(plugin.status))}</span>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </Show>
        <Button variant="secondary" class="mt-3 self-start h-8 px-3 py-1.5" onClick={props.onManage}>
          {props.t("status.popover.plugins.manage")}
        </Button>
      </div>
    </div>
  )
}

function PluginMessage(props: { critical?: boolean; children: string }) {
  return (
    <div
      class="text-14-regular text-center my-auto"
      classList={{ "text-text-base": !props.critical, "text-text-critical-base": props.critical }}
    >
      {props.children}
    </div>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
