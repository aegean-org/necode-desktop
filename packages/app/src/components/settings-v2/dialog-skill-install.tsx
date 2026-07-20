import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { TabsV2 } from "@opencode-ai/ui/v2/tabs-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { SettingsSkillConflict, type SettingsSkillInstallInput } from "./skills-model"
import "./settings-v2.css"

type Method = "url" | "local"
type State = {
  method: Method
  scope: SettingsSkillInstallInput["scope"]
  url: string
  local: string
  pending: boolean
  error?: string
  conflict?: SettingsSkillConflict
}

/** Installs standalone Skills from a repository/feed URL or a local directory. */
export function DialogSkillInstall(props: { onSubmit: (input: SettingsSkillInstallInput) => Promise<void> }) {
  const dialog = useDialog()
  const language = useLanguage()
  const platform = usePlatform()
  const [state, setState] = createStore<State>({
    method: "url",
    scope: "local",
    url: "",
    local: "",
    pending: false,
  })
  const source = () => (state.method === "url" ? state.url : state.local).trim()
  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!source()) return setState("error", language.t(`settings.skills.dialog.install.error.${state.method}`))
    setState({ pending: true, error: undefined })
    try {
      await props.onSubmit({ source: source(), scope: state.scope, replace: !!state.conflict })
      dialog.close()
    } catch (error) {
      if (error instanceof SettingsSkillConflict) {
        setState({ conflict: error, error: undefined })
        return
      }
      setState("error", error instanceof Error ? error.message : String(error))
    } finally {
      setState("pending", false)
    }
  }
  const clearConflict = () => setState({ conflict: undefined, error: undefined })
  const chooseDirectory = async () => {
    if (platform.platform !== "desktop")
      return setState("error", language.t("settings.skills.dialog.install.error.desktop"))
    const selected = await platform.openDirectoryPickerDialog({ multiple: false })
    const directory = Array.isArray(selected) ? selected[0] : selected
    if (directory) setState({ local: directory, conflict: undefined, error: undefined })
  }

  return (
    <Dialog title={language.t("settings.skills.dialog.install.title")} fit class="settings-v2-skill-install-dialog">
      <form class="settings-v2-skill-install-form" aria-busy={state.pending} onSubmit={submit}>
        <div class="settings-v2-skill-install-content">
          <TabsV2
            value={state.method}
            onChange={(value) => setState({ method: value as Method, conflict: undefined, error: undefined })}
          >
            <TabsV2.List class="settings-v2-skill-install-tabs">
              <TabsV2.Trigger value="url" disabled={state.pending}>
                {language.t("settings.skills.dialog.install.method.url")}
              </TabsV2.Trigger>
              <TabsV2.Trigger value="local" disabled={state.pending}>
                {language.t("settings.skills.dialog.install.method.local")}
              </TabsV2.Trigger>
            </TabsV2.List>
          </TabsV2>
          <Show
            when={state.method === "url"}
            fallback={
              <label class="settings-v2-skill-field">
                <span>{language.t("settings.skills.dialog.install.local.label")}</span>
                <div class="settings-v2-skill-picker">
                  <TextInputV2
                    disabled={state.pending}
                    value={state.local}
                    onInput={(event) => {
                      setState("local", event.currentTarget.value)
                      clearConflict()
                    }}
                    placeholder={language.t("settings.skills.dialog.install.local.placeholder")}
                  />
                  <ButtonV2
                    type="button"
                    variant="neutral"
                    disabled={state.pending}
                    onClick={() => void chooseDirectory()}
                  >
                    {language.t("settings.skills.dialog.install.local.choose")}
                  </ButtonV2>
                </div>
              </label>
            }
          >
            <label class="settings-v2-skill-field">
              <span>{language.t("settings.skills.dialog.install.url.label")}</span>
              <TextInputV2
                autofocus
                disabled={state.pending}
                value={state.url}
                onInput={(event) => {
                  setState("url", event.currentTarget.value)
                  clearConflict()
                }}
                placeholder={language.t("settings.skills.dialog.install.url.placeholder")}
              />
            </label>
          </Show>
          <SkillScope
            scope={state.scope}
            disabled={state.pending}
            onSelect={(scope) => setState({ scope, conflict: undefined })}
          />
          <Show when={state.pending}>
            <div class="settings-v2-skill-progress" role="status" aria-live="polite">
              <Spinner class="size-3.5 shrink-0" />
              <span>{language.t("settings.skills.dialog.install.progress")}</span>
            </div>
          </Show>
          <Show when={state.conflict}>
            {(conflict) => (
              <div class="settings-v2-skill-conflict">
                {language.t("settings.skills.dialog.install.conflict", {
                  name: conflict().skill,
                  source: conflict().currentSource,
                })}
              </div>
            )}
          </Show>
          <Show when={state.error}>{(error) => <div class="settings-v2-skill-error">{error()}</div>}</Show>
        </div>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={state.pending} onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 type="submit" variant="contrast" disabled={state.pending}>
            {language.t(
              state.pending
                ? "settings.skills.dialog.install.installing"
                : state.conflict
                  ? "settings.skills.dialog.install.replace"
                  : "settings.skills.dialog.install.action",
            )}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function SkillScope(props: {
  scope: SettingsSkillInstallInput["scope"]
  disabled: boolean
  onSelect: (scope: SettingsSkillInstallInput["scope"]) => void
}) {
  const language = useLanguage()
  const options = () => [
    { value: "local" as const, label: language.t("settings.skills.scope.local") },
    { value: "global" as const, label: language.t("settings.skills.scope.global") },
  ]
  return (
    <label class="settings-v2-skill-field">
      <span>{language.t("settings.skills.dialog.install.scope")}</span>
      <SelectV2
        aria-label={language.t("settings.skills.dialog.install.scope")}
        appearance="base"
        disabled={props.disabled}
        options={options()}
        current={options().find((item) => item.value === props.scope)}
        value={(item) => item.value}
        label={(item) => item.label}
        onSelect={(item) => item && props.onSelect(item.value)}
      />
    </label>
  )
}
