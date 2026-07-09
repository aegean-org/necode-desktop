import type { ProviderAuthMethod } from "@opencode-ai/sdk/v2/client"
import { Mark, Splash } from "@opencode-ai/ui/logo"
import { Spinner } from "@opencode-ai/ui/spinner"
import { createMemo, createResource, Match, type JSX, type ParentProps, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { normalizeProviderList } from "@/context/global-sync/utils"
import { ProviderApiAuthForm } from "./provider-api-auth-form"
import { loadNeAuthMethods, NE_PROVIDER_ID, translateNeAuthMethod } from "./ne-login-gate-auth"
import { neLoginSubmitLabel } from "./ne-login-gate-labels"

const loginRootClass =
  "h-dvh w-screen overflow-hidden bg-[color-mix(in_srgb,var(--background-base)_94%,var(--border-base))] text-text-base"
const loginPanelClass =
  "w-full max-w-[372px] rounded-[8px] border border-border-weaker-base bg-background-base/95 px-7 py-7 shadow-[0_22px_70px_rgba(15,23,42,0.09),0_1px_0_rgba(255,255,255,0.72)_inset]"
const loginFormClass = [
  "mt-8 [app-region:no-drag]",
  "[--border-selected:#ff6b4a]",
  "[--border-weak-selected:rgba(255,107,74,0.16)]",
  "[--button-primary-base:#ff6b4a]",
  "[--icon-strong-active:#de5034]",
  "[--icon-strong-disabled:#f2b7aa]",
  "[--icon-strong-focus:#ef6042]",
  "[--icon-strong-hover:#ef6042]",
  "[--input-base:var(--background-base)]",
  "[&_[data-component=button]]:!h-11",
  "[&_[data-component=button]]:!w-full",
  "[&_[data-component=button]]:!rounded-[8px]",
  "[&_[data-component=button]]:!border-transparent",
  "[&_[data-component=button]]:shadow-none",
  "[&_[data-component=input]]:gap-1.5",
  "[&_[data-slot=input-input]]:!h-11",
  "[&_[data-slot=input-input]]:!px-3.5",
  "[&_[data-slot=input-label]]:text-[12px]",
  "[&_[data-slot=input-label]]:font-medium",
  "[&_[data-slot=input-label]]:text-text-weak",
  "[&_[data-slot=input-wrapper]]:!rounded-[8px]",
  "[&_[data-slot=input-wrapper]]:border-border-weak-base",
].join(" ")
const loginErrorClass =
  "mt-5 flex items-start gap-2 rounded-[8px] border border-border-critical-selected/40 bg-surface-critical-weak px-3 py-2.5 text-13-regular text-text-base [app-region:no-drag]"

/**
 * Blocks app routes until the local server has a real NE API authentication.
 */
export function NeLoginGate(props: ParentProps) {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [store, setStore] = createStore({ pending: false, error: undefined as string | undefined })

  const [methods, actions] = createResource(() =>
    loadNeAuthMethods({
      cached: serverSync().data.provider_auth[NE_PROVIDER_ID],
      fetchAuth: () => serverSDK().client.provider.auth(),
      setProviderAuth: (auth) => serverSync().set("provider_auth", auth),
      formatError: (error) => formatError(error, language.t("common.requestFailed")),
    }),
  )
  const connected = createMemo(() => serverSync().data.provider.connected.includes(NE_PROVIDER_ID))
  const apiMethod = createMemo(() =>
    findApiPromptMethod(methods.latest?.methods ?? serverSync().data.provider_auth[NE_PROVIDER_ID]),
  )
  const localizedApiMethod = createMemo(() => {
    const item = apiMethod()
    if (!item) return
    return {
      ...item,
      method: translateNeAuthMethod({
        method: item.method,
        accountLabel: language.t("ne.login.account.label"),
        accountPlaceholder: language.t("ne.login.account.placeholder"),
        passwordLabel: language.t("ne.login.password.label"),
      }),
    }
  })
  const error = createMemo(() => store.error ?? methods.latest?.error)

  async function authorize(inputs: Record<string, string>) {
    const item = apiMethod()
    if (!item) return
    setStore({ pending: true, error: undefined })
    await serverSDK()
      .client.provider.oauth.authorize(
        { providerID: NE_PROVIDER_ID, method: item.index, inputs },
        { throwOnError: true },
      )
      .then(async () => {
        await serverSDK().client.global.dispose()
        const result = await serverSDK().client.provider.list(undefined, { throwOnError: true })
        if (!result.data) throw new Error("NE provider list refresh returned no data.")
        serverSync().set("provider", normalizeProviderList(result.data))
        setStore({ pending: false, error: undefined })
      })
      .catch((error) => {
        setStore({ pending: false, error: formatError(error, language.t("common.requestFailed")) })
      })
  }

  return (
    <Show
      when={connected()}
      fallback={
        <NeLoginView
          error={error()}
          loading={!serverSync().ready || methods.loading}
          method={localizedApiMethod()?.method}
          pending={store.pending}
          refresh={() => actions.refetch()}
          onSubmit={authorize}
        />
      }
    >
      {props.children}
    </Show>
  )
}

function findApiPromptMethod(methods: ProviderAuthMethod[] | undefined) {
  return methods
    ?.map((method, index) => ({ method, index }))
    .find((item) => item.method.type === "api" && item.method.prompts?.length)
}

function NeLoginView(props: {
  error: string | undefined
  loading: boolean
  method: ProviderAuthMethod | undefined
  pending: boolean
  refresh: () => void
  onSubmit: (inputs: Record<string, string>) => Promise<void>
}) {
  const language = useLanguage()
  return (
    <div class={loginRootClass} data-tauri-drag-region>
      <div class="flex h-full w-full items-center justify-center px-6 py-8">
        <section class={loginPanelClass}>
          <NeLoginHeader />
          <Switch>
            <Match when={props.loading}>
              <div class="mt-8">
                <NeLoginStatus icon={<Spinner />} text={language.t("ne.login.loading")} />
              </div>
            </Match>
            <Match when={props.method}>
              <div class={loginFormClass}>
                <ProviderApiAuthForm
                  method={props.method}
                  pending={props.pending}
                  submitLabel={neLoginSubmitLabel(props.pending, language.t)}
                  onSubmit={props.onSubmit}
                />
              </div>
            </Match>
            <Match when={true}>
              <button type="button" class="mt-8 text-left [app-region:no-drag]" onClick={props.refresh}>
                <NeLoginStatus
                  icon={<Splash class="size-8 opacity-60" />}
                  text={language.t("ne.login.unavailable")}
                />
              </button>
            </Match>
          </Switch>
          <Show when={props.error}>
            <div class={loginErrorClass}>
              <Icon name="circle-ban-sign" class="mt-0.5 size-4 shrink-0 text-icon-critical-base" />
              <span>{language.t("provider.connect.status.failed", { error: props.error ?? "" })}</span>
            </div>
          </Show>
        </section>
      </div>
    </div>
  )
}

function NeLoginHeader() {
  const language = useLanguage()
  return (
    <div class="flex flex-col items-center text-center">
      <div class="flex size-12 items-center justify-center rounded-[8px] shadow-[0_10px_26px_rgba(255,107,74,0.18)]">
        <Mark class="size-12" />
      </div>
      <div class="mt-4">
        <h1 class="text-[21px] font-semibold leading-7 text-text-strong">{language.t("ne.login.title")}</h1>
        <p class="mt-1.5 text-13-regular text-text-weak">{language.t("ne.login.description")}</p>
      </div>
    </div>
  )
}

function NeLoginStatus(props: { icon: JSX.Element; text: string }) {
  return (
    <div class="flex items-center gap-3 text-14-regular text-text-base">
      {props.icon}
      <span>{props.text}</span>
    </div>
  )
}

function formatError(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "data" in value) {
    const data = (value as { data?: { message?: unknown } }).data
    if (typeof data?.message === "string" && data.message) return data.message
  }
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return fallback
}
