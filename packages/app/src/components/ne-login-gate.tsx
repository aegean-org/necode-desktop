import type { ProviderAuthMethod } from "@opencode-ai/sdk/v2/client"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { Splash } from "@opencode-ai/ui/logo"
import { Spinner } from "@opencode-ai/ui/spinner"
import { createMemo, createResource, Match, type JSX, type ParentProps, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { normalizeProviderList } from "@/context/global-sync/utils"
import { ProviderApiAuthForm } from "./provider-api-auth-form"

const NE_PROVIDER_ID = "ne"

/**
 * Blocks app routes until the local server has a real NE API authentication.
 */
export function NeLoginGate(props: ParentProps) {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [store, setStore] = createStore({ pending: false, error: undefined as string | undefined })

  const [methods, actions] = createResource(async () => {
    const cached = serverSync().data.provider_auth[NE_PROVIDER_ID]
    if (cached) return cached
    const result = await serverSDK().client.provider.auth()
    serverSync().set("provider_auth", result.data ?? {})
    return result.data?.[NE_PROVIDER_ID] ?? []
  })
  const connected = createMemo(() => serverSync().data.provider.connected.includes(NE_PROVIDER_ID))
  const apiMethod = createMemo(() => findApiPromptMethod(methods.latest ?? serverSync().data.provider_auth[NE_PROVIDER_ID]))
  const error = createMemo(() =>
    store.error ?? (methods.error ? formatError(methods.error, language.t("common.requestFailed")) : undefined),
  )

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
          method={apiMethod()?.method}
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
    <div class="h-dvh w-screen bg-background-base text-text-base">
      <div class="mx-auto flex h-full w-full max-w-[420px] flex-col justify-center gap-7 px-6">
        <NeLoginHeader />
        <Switch>
          <Match when={props.loading}>
            <NeLoginStatus icon={<Spinner />} text={language.t("ne.login.loading")} />
          </Match>
          <Match when={props.method}>
            <ProviderApiAuthForm
              method={props.method}
              pending={props.pending}
              submitLabel={props.pending ? language.t("common.saving") : language.t("ne.login.submit")}
              onSubmit={props.onSubmit}
            />
          </Match>
          <Match when={true}>
            <button type="button" class="text-left" onClick={props.refresh}>
              <NeLoginStatus icon={<Splash class="h-10 w-8 opacity-60" />} text={language.t("ne.login.unavailable")} />
            </button>
          </Match>
        </Switch>
        <Show when={props.error}>
          <div class="flex items-start gap-2 rounded-md bg-surface-base px-3 py-2 text-13-regular text-text-base shadow-xs-border-base">
            <Icon name="circle-ban-sign" class="mt-0.5 size-4 shrink-0 text-icon-critical-base" />
            <span>{language.t("provider.connect.status.failed", { error: props.error ?? "" })}</span>
          </div>
        </Show>
      </div>
    </div>
  )
}

function NeLoginHeader() {
  const language = useLanguage()
  return (
    <div class="flex items-center gap-3">
      <div class="flex size-10 items-center justify-center rounded-md bg-surface-base shadow-xs-border-base">
        <ProviderIcon id={NE_PROVIDER_ID} class="size-5 icon-strong-base" />
      </div>
      <div>
        <h1 class="text-20-medium text-text-strong">{language.t("ne.login.title")}</h1>
        <p class="mt-1 text-13-regular text-text-weak">{language.t("ne.login.description")}</p>
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
