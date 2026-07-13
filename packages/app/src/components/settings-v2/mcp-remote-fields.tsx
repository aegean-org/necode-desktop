import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { Show } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { McpFormStore } from "./mcp-form"
import { McpKeyValueEditor } from "./mcp-key-value-editor"

type FieldProps = { form: McpFormStore; setForm: SetStoreFunction<McpFormStore> }

/** Renders remote URL, header, and OAuth fields. */
export function McpRemoteFields(props: FieldProps) {
  const language = useLanguage()
  return (
    <div class="settings-v2-mcp-fields">
      <UrlField {...props} />
      <McpKeyValueEditor
        field="headers"
        form={props.form}
        setForm={props.setForm}
        label={language.t("settings.mcp.dialog.remote.header")}
        keyPlaceholder={language.t("settings.mcp.dialog.remote.headerKey")}
        valuePlaceholder={language.t("settings.mcp.dialog.remote.headerValue")}
      />
      <OAuthFields {...props} />
    </div>
  )
}

function UrlField(props: FieldProps) {
  const language = useLanguage()
  return (
    <label class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.remote.url")}</span>
      <TextInputV2
        id="mcp-url"
        value={props.form.url}
        placeholder={language.t("settings.mcp.dialog.remote.urlPlaceholder")}
        invalid={!!props.form.errors.url}
        aria-describedby={props.form.errors.url ? "mcp-url-error" : undefined}
        disabled={props.form.submitting}
        onInput={(event) => props.setForm("url", event.currentTarget.value)}
      />
      <Show when={props.form.errors.url}>
        <span id="mcp-url-error" class="settings-v2-mcp-error">
          {language.t("settings.mcp.dialog.error.url")}
        </span>
      </Show>
    </label>
  )
}

function OAuthFields(props: FieldProps) {
  const language = useLanguage()
  const options = () => [
    { value: "auto" as const, label: language.t("settings.mcp.dialog.oauth.auto") },
    { value: "disabled" as const, label: language.t("settings.mcp.dialog.oauth.disabled") },
    { value: "explicit" as const, label: language.t("settings.mcp.dialog.oauth.explicit") },
  ]
  return (
    <>
      <label class="settings-v2-mcp-field">
        <span class="settings-v2-mcp-label">{language.t("settings.mcp.dialog.oauth.label")}</span>
        <SelectV2
          aria-label={language.t("settings.mcp.dialog.oauth.label")}
          appearance="base"
          options={options()}
          current={options().find((option) => option.value === props.form.oauthMode)}
          value={(option) => option.value}
          label={(option) => option.label}
          disabled={props.form.submitting}
          onSelect={(option) => option && props.setForm("oauthMode", option.value)}
        />
      </label>
      <Show when={props.form.oauthMode === "explicit"}>
        <OAuthExplicitFields {...props} />
      </Show>
    </>
  )
}

function OAuthExplicitFields(props: FieldProps) {
  const language = useLanguage()
  return (
    <div class="settings-v2-mcp-grid">
      <OAuthField {...props} field="clientId" label={language.t("settings.mcp.dialog.oauth.clientId")} />
      <OAuthField
        {...props}
        field="clientSecret"
        label={language.t("settings.mcp.dialog.oauth.clientSecret")}
        type="password"
      />
      <OAuthField {...props} field="oauthScope" label={language.t("settings.mcp.dialog.oauth.scope")} />
      <OAuthField
        {...props}
        field="callbackPort"
        label={language.t("settings.mcp.dialog.oauth.callbackPort")}
        invalid={!!props.form.errors.callbackPort}
      />
      <OAuthField
        {...props}
        field="redirectUri"
        label={language.t("settings.mcp.dialog.oauth.redirectUri")}
        invalid={!!props.form.errors.redirectUri}
      />
    </div>
  )
}

function OAuthField(
  props: FieldProps & {
    field: "clientId" | "clientSecret" | "oauthScope" | "callbackPort" | "redirectUri"
    label: string
    type?: "text" | "password"
    invalid?: boolean
  },
) {
  const language = useLanguage()
  const inputId = `mcp-oauth-${props.field}`
  const errorId = `${inputId}-error`
  return (
    <label class="settings-v2-mcp-field">
      <span class="settings-v2-mcp-label">{props.label}</span>
      <TextInputV2
        id={inputId}
        type={props.type}
        value={props.form[props.field]}
        invalid={props.invalid}
        aria-describedby={props.invalid ? errorId : undefined}
        disabled={props.form.submitting}
        onInput={(event) => props.setForm(props.field, event.currentTarget.value)}
      />
      <Show when={props.invalid}>
        <span id={errorId} class="settings-v2-mcp-error">
          {language.t("settings.mcp.dialog.error.value")}
        </span>
      </Show>
    </label>
  )
}
