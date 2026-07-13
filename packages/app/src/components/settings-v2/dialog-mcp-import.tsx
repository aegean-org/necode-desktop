import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { Show } from "solid-js"
import { createStore, type SetStoreFunction } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { McpForm } from "./mcp-form"
import { parseMcpImport, type McpImportError } from "./mcp-import"
import "./settings-v2.css"

type ImportProps = {
  scope: McpForm["scope"]
  onContinue: (form: McpForm) => void
}
type ImportStore = { text: string; scope: McpForm["scope"]; error?: McpImportError }
type FieldProps = { store: ImportStore; setStore: SetStoreFunction<ImportStore> }

/** Parses one pasted MCP configuration before opening the editable form. */
export function DialogMcpImport(props: ImportProps) {
  const language = useLanguage()
  const [store, setStore] = createStore<ImportStore>({
    text: "",
    scope: props.scope,
    error: undefined as McpImportError | undefined,
  })
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = parseMcpImport(store.text, store.scope)
    if ("error" in result) {
      setStore("error", result.error)
      return
    }
    setStore("error", undefined)
    props.onContinue(result.form)
  }
  return (
    <Dialog title={language.t("settings.mcp.import.title")} fit>
      <form class="settings-v2-mcp-import-form" onSubmit={submit}>
        <ImportConfigField store={store} setStore={setStore} />
        <ImportScopeField store={store} setStore={setStore} />
        <DialogFooter>
          <ButtonV2 type="submit" variant="contrast">
            {language.t("settings.mcp.import.check")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function ImportConfigField(props: FieldProps) {
  const language = useLanguage()
  return (
    <label class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.import.config")}</span>
      <TextareaV2
        autofocus
        rows={10}
        value={props.store.text}
        invalid={!!props.store.error}
        aria-describedby={props.store.error ? "mcp-import-error" : undefined}
        placeholder={language.t("settings.mcp.import.placeholder")}
        onInput={(event) => props.setStore({ text: event.currentTarget.value, error: undefined })}
      />
      <Show when={props.store.error}>
        {(error) => (
          <span id="mcp-import-error" class="settings-v2-mcp-error">
            {importError(error(), language.t)}
          </span>
        )}
      </Show>
    </label>
  )
}

function ImportScopeField(props: FieldProps) {
  const language = useLanguage()
  const options = () => [
    { value: "project" as const, label: language.t("settings.mcp.dialog.scope.project") },
    { value: "global" as const, label: language.t("settings.mcp.dialog.scope.global") },
  ]
  return (
    <div class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.import.scope")}</span>
      <SelectV2
        aria-label={language.t("settings.mcp.import.scope")}
        appearance="base"
        options={options()}
        current={options().find((scope) => scope.value === props.store.scope)}
        value={(scope) => scope.value}
        label={(scope) => scope.label}
        onSelect={(scope) => scope && props.setStore("scope", scope.value)}
      />
    </div>
  )
}

function importError(error: McpImportError, t: ReturnType<typeof useLanguage>["t"]) {
  if (error === "invalid_jsonc") return t("settings.mcp.import.error.invalidJsonc")
  if (error === "single_entry") return t("settings.mcp.import.error.singleEntry")
  if (error === "unsupported_field") return t("settings.mcp.import.error.unsupportedField")
  return t("settings.mcp.import.error.invalidEntry")
}
