import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { TabsV2 } from "@opencode-ai/ui/v2/tabs-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { firstPickedDirectory, firstPickedFile, normalizeLocalSpec, normalizeNpmSpec } from "./plugin-install-model"
import "./settings-v2.css"

export type PluginInstallResult = { spec: string; scope: "local" | "global" }
type Method = "npm" | "local"
type State = {
  method: Method
  scope: PluginInstallResult["scope"]
  npm: string
  local: string
  pending: boolean
  error?: string
}

/** Installs an npm plugin or registers a native local plugin path. */
export function DialogPluginInstall(props: { onSubmit: (result: PluginInstallResult) => Promise<void> }) {
  const dialog = useDialog()
  const language = useLanguage()
  const platform = usePlatform()
  const [state, setState] = createStore<State>({ method: "npm", scope: "local", npm: "", local: "", pending: false })
  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const raw = state.method === "npm" ? state.npm : state.local
    if (!raw.trim()) return setState("error", language.t(`settings.plugins.dialog.install.error.${state.method}`))
    const spec = state.method === "npm" ? normalizeNpmSpec(raw) : normalizeLocalSpec(raw)
    setState({ pending: true, error: undefined })
    try {
      await props.onSubmit({ spec, scope: state.scope })
      dialog.close()
    } finally {
      setState("pending", false)
    }
  }
  const chooseDirectory = async () => {
    if (platform.platform !== "desktop")
      return setState("error", language.t("settings.plugins.dialog.install.error.desktop"))
    const selected = firstPickedDirectory(await platform.openDirectoryPickerDialog({ multiple: false }))
    if (selected) setState({ local: selected, error: undefined })
  }
  const chooseFile = async () => {
    if (!platform.openFilePathPickerDialog)
      return setState("error", language.t("settings.plugins.dialog.install.error.desktop"))
    const selected = firstPickedFile(
      await platform.openFilePathPickerDialog({ multiple: false, extensions: ["js", "ts", "mjs", "cjs"] }),
    )
    if (selected) setState({ local: selected, error: undefined })
  }
  return (
    <Dialog title={language.t("settings.plugins.dialog.install.title")} fit class="settings-v2-plugin-install-dialog">
      <form class="settings-v2-plugin-install-form" onSubmit={submit}>
        <InstallMethod state={state} setMethod={(method) => setState({ method, error: undefined })} />
        <Show
          when={state.method === "npm"}
          fallback={<LocalFields state={state} chooseDirectory={chooseDirectory} chooseFile={chooseFile} />}
        >
          <NpmField value={state.npm} onInput={(value) => setState({ npm: value, error: undefined })} />
        </Show>
        <ScopeField scope={state.scope} onSelect={(scope) => setState("scope", scope)} />
        <Show when={state.error}>{(error) => <div class="settings-v2-plugin-error">{error()}</div>}</Show>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={state.pending} onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 type="submit" variant="contrast" disabled={state.pending}>
            {language.t("settings.plugins.dialog.install.action")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function InstallMethod(props: { state: State; setMethod: (method: Method) => void }) {
  const language = useLanguage()
  return (
    <TabsV2 value={props.state.method} onChange={(value) => props.setMethod(value as Method)}>
      <TabsV2.List class="settings-v2-plugin-install-tabs">
        <TabsV2.Trigger value="npm">{language.t("settings.plugins.dialog.install.method.npm")}</TabsV2.Trigger>
        <TabsV2.Trigger value="local">{language.t("settings.plugins.dialog.install.method.local")}</TabsV2.Trigger>
      </TabsV2.List>
    </TabsV2>
  )
}

function NpmField(props: { value: string; onInput: (value: string) => void }) {
  const language = useLanguage()
  return (
    <label class="settings-v2-plugin-field">
      <span>{language.t("settings.plugins.dialog.install.npm.label")}</span>
      <TextInputV2
        autofocus
        value={props.value}
        placeholder={language.t("settings.plugins.dialog.install.npm.placeholder")}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </label>
  )
}

function LocalFields(props: { state: State; chooseDirectory: () => Promise<void>; chooseFile: () => Promise<void> }) {
  const language = useLanguage()
  return (
    <div class="settings-v2-plugin-field">
      <span>{language.t("settings.plugins.dialog.install.local.path")}</span>
      <TextInputV2 value={props.state.local} readOnly />
      <div class="settings-v2-plugin-picker-actions">
        <ButtonV2 type="button" variant="neutral" onClick={() => void props.chooseDirectory()}>
          {language.t("settings.plugins.dialog.install.local.chooseDirectory")}
        </ButtonV2>
        <ButtonV2 type="button" variant="ghost-muted" onClick={() => void props.chooseFile()}>
          {language.t("settings.plugins.dialog.install.local.chooseFile")}
        </ButtonV2>
      </div>
    </div>
  )
}

function ScopeField(props: {
  scope: PluginInstallResult["scope"]
  onSelect: (scope: PluginInstallResult["scope"]) => void
}) {
  const language = useLanguage()
  const options = () => [
    { value: "local" as const, label: language.t("settings.plugins.scope.local") },
    { value: "global" as const, label: language.t("settings.plugins.scope.global") },
  ]
  return (
    <div class="settings-v2-plugin-field">
      <span>{language.t("settings.plugins.dialog.install.scope")}</span>
      <SelectV2
        aria-label={language.t("settings.plugins.dialog.install.scope")}
        appearance="base"
        options={options()}
        current={options().find((item) => item.value === props.scope)}
        value={(item) => item.value}
        label={(item) => item.label}
        onSelect={(item) => item && props.onSelect(item.value)}
      />
    </div>
  )
}
