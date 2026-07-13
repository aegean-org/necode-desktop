import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createUniqueId, For, Show } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { CommandRow, McpFormStore } from "./mcp-form"
import { McpKeyValueEditor } from "./mcp-key-value-editor"

type FieldProps = { form: McpFormStore; setForm: SetStoreFunction<McpFormStore> }

/** Renders local command, working-directory, and environment fields. */
export function McpLocalFields(props: FieldProps) {
  const language = useLanguage()
  return (
    <div class="settings-v2-mcp-fields">
      <CommandEditor {...props} />
      <label class="settings-v2-mcp-field">
        <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.local.cwd")}</span>
        <TextInputV2
          value={props.form.cwd}
          placeholder={language.t("settings.mcp.dialog.local.cwdPlaceholder")}
          disabled={props.form.submitting}
          onInput={(event) => props.setForm("cwd", event.currentTarget.value)}
        />
      </label>
      <McpKeyValueEditor
        field="environment"
        form={props.form}
        setForm={props.setForm}
        label={language.t("settings.mcp.dialog.local.environment")}
        keyPlaceholder={language.t("settings.mcp.dialog.local.environmentKey")}
        valuePlaceholder={language.t("settings.mcp.dialog.local.environmentValue")}
      />
    </div>
  )
}

function CommandEditor(props: FieldProps) {
  const language = useLanguage()
  const add = () => props.setForm("command", (rows) => [...rows, { value: "" }])
  const remove = (index: number) =>
    props.setForm("command", (rows) => (rows.length === 1 ? [{ value: "" }] : rows.filter((_, row) => row !== index)))
  return (
    <fieldset class="settings-v2-mcp-fieldset">
      <legend class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.local.command")}</legend>
      <div class="settings-v2-mcp-command-list">
        <For each={props.form.command}>
          {(row, index) => <CommandEditorRow {...props} row={row} index={index()} onRemove={remove} />}
        </For>
      </div>
      <ButtonV2
        type="button"
        variant="ghost-muted"
        icon="plus"
        aria-label={language.t("settings.mcp.dialog.local.addArgument")}
        data-action="mcp-command-add"
        disabled={props.form.submitting}
        onClick={add}
      >
        {language.t("settings.mcp.dialog.local.addArgument")}
      </ButtonV2>
    </fieldset>
  )
}

function CommandEditorRow(props: FieldProps & { row: CommandRow; index: number; onRemove: (index: number) => void }) {
  const language = useLanguage()
  const id = createUniqueId()
  const inputId = `${id}-input`
  const errorId = `${id}-error`
  const hasError = () => props.index === 0 && !!props.form.errors.command
  const label = () =>
    props.index === 0
      ? language.t("settings.mcp.dialog.local.executable")
      : language.t("settings.mcp.dialog.local.argument", { index: props.index })
  return (
    <div class="settings-v2-mcp-command-row" data-row-id={id}>
      <TextInputV2
        id={inputId}
        aria-label={label()}
        value={props.row.value}
        placeholder={label()}
        invalid={hasError()}
        aria-describedby={hasError() ? errorId : undefined}
        disabled={props.form.submitting}
        onInput={(event) => props.setForm("command", props.index, "value", event.currentTarget.value)}
      />
      <ButtonV2
        type="button"
        variant="ghost-muted"
        icon="trash"
        aria-label={language.t("settings.mcp.dialog.local.removeCommand", { row: props.index + 1 })}
        disabled={props.form.submitting}
        onClick={() => props.onRemove(props.index)}
      />
      <Show when={hasError()}>
        <span id={errorId} class="settings-v2-mcp-error">
          {language.t("settings.mcp.dialog.error.required")}
        </span>
      </Show>
    </div>
  )
}
