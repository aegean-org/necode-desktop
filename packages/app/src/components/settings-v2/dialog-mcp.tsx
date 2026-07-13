import type { McpConfigEntry } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import {
  createMcpForm,
  replaceTypeFields,
  validateMcpForm,
  type McpExistingEntry,
  type McpFormErrorCode,
  type McpForm,
  type McpFormResult,
  type McpFormStore,
} from "./mcp-form"
import { McpLocalFields } from "./mcp-local-fields"
import { McpRemoteFields } from "./mcp-remote-fields"
import "./settings-v2.css"

type DialogMcpProps = {
  existingEntries: readonly McpExistingEntry[]
  onSubmit: (result: McpFormResult) => Promise<void>
} & ({ entry: McpConfigEntry; initialForm?: never } | { entry?: never; initialForm?: McpForm })
type Controller = ReturnType<typeof useMcpDialog>

/** Creates or edits one writable persistent MCP configuration. */
export function DialogMcp(props: DialogMcpProps) {
  const language = useLanguage()
  const controller = useMcpDialog(props)
  return (
    <Dialog
      title={language.t(props.entry ? "settings.mcp.dialog.editTitle" : "settings.mcp.dialog.addTitle")}
      size="large"
      fit
      class="settings-v2-mcp-dialog"
    >
      <form class="settings-v2-mcp-form" onSubmit={controller.submit}>
        <div class="settings-v2-mcp-form-scroll">
          <GeneralFields controller={controller} />
          <EnabledField controller={controller} />
          <TypeSwitchConfirm controller={controller} />
          <Show
            when={controller.form.type === "local"}
            fallback={<McpRemoteFields form={controller.form} setForm={controller.setForm} />}
          >
            <McpLocalFields form={controller.form} setForm={controller.setForm} />
          </Show>
        </div>
        <McpFormFooter controller={controller} />
      </form>
    </Dialog>
  )
}

function useMcpDialog(props: DialogMcpProps) {
  const dialog = useDialog()
  const [form, setForm] = createStore<McpFormStore>({
    ...(props.initialForm ?? createMcpForm(props.entry)),
    errors: {},
    submitting: false,
  })
  const selectType = (type: "local" | "remote") => {
    if (type === form.type) return
    setForm("pendingType", type)
  }
  const confirmType = () => {
    if (!form.pendingType) return
    setForm({ ...replaceTypeFields(form, form.pendingType), errors: {}, submitting: form.submitting })
  }
  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (form.submitting) return
    const validation = validateMcpForm(form, props.existingEntries)
    setForm("errors", validation.errors)
    if (!validation.result) return
    setForm("submitting", true)
    try {
      await props.onSubmit(validation.result)
      dialog.close()
    } finally {
      setForm("submitting", false)
    }
  }
  return { dialog, form, setForm, selectType, confirmType, submit }
}

function GeneralFields(props: { controller: Controller }) {
  return (
    <div class="settings-v2-mcp-grid">
      <NameField controller={props.controller} />
      <ScopeField controller={props.controller} />
      <TypeField controller={props.controller} />
      <TimeoutField controller={props.controller} />
    </div>
  )
}

function NameField(props: { controller: Controller }) {
  const language = useLanguage()
  return (
    <label class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.field.name")}</span>
      <TextInputV2
        id="mcp-name"
        autofocus
        value={props.controller.form.name}
        invalid={!!props.controller.form.errors.name}
        aria-describedby={props.controller.form.errors.name ? "mcp-name-error" : undefined}
        disabled={props.controller.form.submitting}
        onInput={(event) => props.controller.setForm("name", event.currentTarget.value)}
      />
      <Show when={props.controller.form.errors.name}>
        {(error) => (
          <span id="mcp-name-error" class="settings-v2-mcp-error">
            {fieldError(error(), language.t)}
          </span>
        )}
      </Show>
    </label>
  )
}

function ScopeField(props: { controller: Controller }) {
  const language = useLanguage()
  const options = () => [
    { value: "project" as const, label: language.t("settings.mcp.dialog.scope.project") },
    { value: "global" as const, label: language.t("settings.mcp.dialog.scope.global") },
  ]
  return (
    <div class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.field.scope")}</span>
      <Show
        when={props.controller.form.mode === "create"}
        fallback={
          <span class="settings-v2-mcp-readonly-value">
            {language.t(`settings.mcp.dialog.scope.${props.controller.form.scope}`)}
          </span>
        }
      >
        <SelectV2
          aria-label={language.t("settings.mcp.dialog.field.scope")}
          appearance="base"
          options={options()}
          current={options().find((option) => option.value === props.controller.form.scope)}
          value={(option) => option.value}
          label={(option) => option.label}
          disabled={props.controller.form.submitting}
          onSelect={(option) => option && props.controller.setForm("scope", option.value)}
        />
      </Show>
    </div>
  )
}

function TypeField(props: { controller: Controller }) {
  const language = useLanguage()
  const options = () => [
    { value: "local" as const, label: language.t("settings.mcp.dialog.type.local") },
    { value: "remote" as const, label: language.t("settings.mcp.dialog.type.remote") },
  ]
  return (
    <label class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.field.type")}</span>
      <SelectV2
        aria-label={language.t("settings.mcp.dialog.field.type")}
        appearance="base"
        options={options()}
        current={options().find((option) => option.value === props.controller.form.type)}
        value={(option) => option.value}
        label={(option) => option.label}
        disabled={props.controller.form.submitting}
        onSelect={(option) => option && props.controller.selectType(option.value)}
      />
    </label>
  )
}

function TimeoutField(props: { controller: Controller }) {
  const language = useLanguage()
  return (
    <label class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.field.timeout")}</span>
      <TextInputV2
        id="mcp-timeout"
        inputmode="numeric"
        numeric
        value={props.controller.form.timeout}
        placeholder={language.t("settings.mcp.dialog.field.timeoutPlaceholder")}
        invalid={!!props.controller.form.errors.timeout}
        aria-describedby={props.controller.form.errors.timeout ? "mcp-timeout-error" : undefined}
        disabled={props.controller.form.submitting}
        onInput={(event) => props.controller.setForm("timeout", event.currentTarget.value)}
      />
      <Show when={props.controller.form.errors.timeout}>
        <span id="mcp-timeout-error" class="settings-v2-mcp-error">
          {language.t("settings.mcp.dialog.error.positiveInteger")}
        </span>
      </Show>
    </label>
  )
}

function EnabledField(props: { controller: Controller }) {
  const language = useLanguage()
  return (
    <label class="settings-v2-mcp-switch">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.field.enabled")}</span>
      <Switch
        checked={props.controller.form.enabled}
        disabled={props.controller.form.submitting}
        onChange={(enabled) => props.controller.setForm("enabled", enabled)}
      />
    </label>
  )
}

function TypeSwitchConfirm(props: { controller: Controller }) {
  const language = useLanguage()
  return (
    <Show when={props.controller.form.pendingType}>
      <div class="settings-v2-mcp-type-confirm" role="alert">
        <span>{language.t("settings.mcp.dialog.typeSwitch.message")}</span>
        <div class="settings-v2-mcp-type-actions">
          <ButtonV2 type="button" variant="neutral" onClick={() => props.controller.setForm("pendingType", undefined)}>
            {language.t("settings.mcp.dialog.typeSwitch.cancel")}
          </ButtonV2>
          <ButtonV2 type="button" variant="contrast" onClick={props.controller.confirmType}>
            {language.t("settings.mcp.dialog.typeSwitch.confirm")}
          </ButtonV2>
        </div>
      </div>
    </Show>
  )
}

function McpFormFooter(props: { controller: Controller }) {
  const language = useLanguage()
  return (
    <DialogFooter>
      <ButtonV2
        type="button"
        variant="neutral"
        disabled={props.controller.form.submitting}
        onClick={() => props.controller.dialog.close()}
      >
        {language.t("common.cancel")}
      </ButtonV2>
      <ButtonV2 type="submit" variant="contrast" data-action="mcp-save" disabled={props.controller.form.submitting}>
        {language.t("common.save")}
      </ButtonV2>
    </DialogFooter>
  )
}

function fieldError(error: McpFormErrorCode, t: ReturnType<typeof useLanguage>["t"]) {
  if (error === "required") return t("settings.mcp.dialog.error.required")
  if (error === "reserved") return t("settings.mcp.dialog.error.reserved")
  if (error === "duplicate") return t("settings.mcp.dialog.error.duplicate")
  return t("settings.mcp.dialog.error.invalidName")
}
