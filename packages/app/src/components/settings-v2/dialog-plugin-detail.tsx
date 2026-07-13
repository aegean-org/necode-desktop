import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { pluginStatusLabel } from "./plugin-model"
import "./plugin.css"

/** Shows runtime, source, capability, and failure details for one plugin. */
export function DialogPluginDetail(props: { entry: PluginEntry }) {
  const dialog = useDialog()
  const language = useLanguage()
  const entry = props.entry
  return (
    <Dialog title={entry.name} fit class="settings-v2-plugin-detail-dialog">
      <div class="settings-v2-plugin-detail-scroll">
        <div class="settings-v2-plugin-detail-heading">
          <Tag>{language.t(pluginStatusLabel(entry.status))}</Tag>
          <Show when={entry.version}>{(version) => <span>v{version()}</span>}</Show>
        </div>
        <Show when={entry.description}>
          {(description) => <p class="settings-v2-plugin-detail-description">{description()}</p>}
        </Show>
        <div class="settings-v2-plugin-detail-grid">
          <DetailField
            label={language.t("settings.plugins.detail.source")}
            value={language.t(`settings.plugins.source.${entry.source}`)}
          />
          <DetailField
            label={language.t("settings.plugins.detail.scope")}
            value={language.t(`settings.plugins.scope.${entry.scope}`)}
          />
          <DetailField label={language.t("settings.plugins.detail.key")} value={entry.key} />
          <DetailField label={language.t("settings.plugins.detail.spec")} value={entry.spec} />
          <Show when={entry.target}>
            {(target) => <DetailField label={language.t("settings.plugins.detail.target")} value={target()} />}
          </Show>
        </div>
        <Show when={entry.error}>
          {(error) => (
            <div class="settings-v2-plugin-detail-error">
              <DetailField label={language.t("settings.plugins.detail.errorStage")} value={error().stage} />
              <DetailField label={language.t("settings.plugins.detail.errorMessage")} value={error().message} />
            </div>
          )}
        </Show>
        <CapabilitySection label={language.t("settings.plugins.detail.capabilities")} values={entry.capabilities} />
        <CapabilitySection label={language.t("settings.plugins.detail.tools")} values={entry.tools} />
        <CapabilitySection label={language.t("settings.plugins.detail.skills")} values={entry.skills} />
      </div>
      <DialogFooter>
        <ButtonV2 type="button" variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.close")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}

function DetailField(props: { label: string; value: string }) {
  return (
    <div class="settings-v2-plugin-detail-field">
      <span>{props.label}</span>
      <code>{props.value}</code>
    </div>
  )
}

function CapabilitySection(props: { label: string; values: readonly string[] }) {
  const language = useLanguage()
  return (
    <div class="settings-v2-plugin-detail-capability">
      <span>{props.label}</span>
      <Show when={props.values.length > 0} fallback={<p>{language.t("settings.plugins.detail.none")}</p>}>
        <div>
          <For each={props.values}>{(value) => <Tag>{value}</Tag>}</For>
        </div>
      </Show>
    </div>
  )
}
