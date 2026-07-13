import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createUniqueId, For, Show } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { McpFormStore, McpKeyValueErrorCode, KeyValueRow } from "./mcp-form"

type KeyValueField = "environment" | "headers"
type EditorProps = {
  field: KeyValueField
  form: McpFormStore
  setForm: SetStoreFunction<McpFormStore>
  label: string
  keyPlaceholder: string
  valuePlaceholder: string
}

/** Edits one key-value collection inside the shared MCP form store. */
export function McpKeyValueEditor(props: EditorProps) {
  const language = useLanguage()
  const add = () => props.setForm(props.field, (rows) => [...rows, { key: "", value: "" }])
  const remove = (index: number) => props.setForm(props.field, (rows) => rows.filter((_, row) => row !== index))
  return (
    <fieldset class="settings-v2-mcp-fieldset">
      <legend class="settings-v2-mcp-label">{props.label}</legend>
      <div class="settings-v2-mcp-key-values">
        <For each={props.form[props.field]}>
          {(row, index) => <KeyValueEditorRow {...props} row={row} index={index()} onRemove={remove} />}
        </For>
      </div>
      <ButtonV2 type="button" variant="ghost-muted" icon="plus" disabled={props.form.submitting} onClick={add}>
        {language.t("settings.mcp.dialog.keyValue.add", { label: props.label })}
      </ButtonV2>
    </fieldset>
  )
}

function KeyValueEditorRow(
  props: EditorProps & { row: KeyValueRow; index: number; onRemove: (index: number) => void },
) {
  const language = useLanguage()
  const ids = createRowIds(createUniqueId())
  const error = () => props.form.errors[props.field]?.[props.index]
  const translation = (key: "key" | "value" | "remove") =>
    language.t(`settings.mcp.dialog.keyValue.${key}`, { label: props.label, row: props.index + 1 })
  return (
    <div class="settings-v2-mcp-key-value" data-row-id={ids.row}>
      <TextInputV2
        id={ids.key}
        aria-label={translation("key")}
        value={props.row.key}
        placeholder={props.keyPlaceholder}
        invalid={!!error()}
        aria-describedby={error() ? ids.error : undefined}
        disabled={props.form.submitting}
        onInput={(event) => props.setForm(props.field, props.index, "key", event.currentTarget.value)}
      />
      <TextInputV2
        id={ids.value}
        aria-label={translation("value")}
        value={props.row.value}
        placeholder={props.valuePlaceholder}
        invalid={!!error()}
        aria-describedby={error() ? ids.error : undefined}
        disabled={props.form.submitting}
        onInput={(event) => props.setForm(props.field, props.index, "value", event.currentTarget.value)}
      />
      <ButtonV2
        type="button"
        variant="ghost-muted"
        icon="xmark-small"
        aria-label={translation("remove")}
        disabled={props.form.submitting}
        onClick={() => props.onRemove(props.index)}
      />
      <Show when={error()}>
        {(value) => (
          <span id={ids.error} class="settings-v2-mcp-row-error">
            {keyValueError(value(), language.t)}
          </span>
        )}
      </Show>
    </div>
  )
}

function createRowIds(id: string) {
  return { row: id, key: `${id}-key`, value: `${id}-value`, error: `${id}-error` }
}

function keyValueError(error: McpKeyValueErrorCode, t: ReturnType<typeof useLanguage>["t"]) {
  if (error === "duplicate") return t("settings.mcp.dialog.error.duplicateKey")
  return t("settings.mcp.dialog.error.incompleteKeyValue")
}
