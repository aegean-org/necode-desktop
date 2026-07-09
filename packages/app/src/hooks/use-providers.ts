import { useServerSync } from "@/context/server-sync"
import { decode64 } from "@/utils/base64"
import { useParams } from "@solidjs/router"
import { Iterable, pipe } from "effect"
import { createMemo } from "solid-js"
import { sortPopularProviders } from "./provider-order"
import { customProviderIDs, visibleEnabledProviders } from "./provider-visibility"

export { isConnectableProvider, popularProviders } from "./provider-order"

export function useProviders() {
  const serverSync = useServerSync()
  const params = useParams()
  const dir = createMemo(() => decode64(params.dir) ?? "")
  const providers = () => {
    if (dir()) {
      const [projectStore] = serverSync().child(dir())
      if (projectStore.provider_ready) return projectStore.provider
    }
    return serverSync().data.provider
  }
  const connected = () => {
    const connected = new Set(providers().connected)
    return pipe(
      providers().all,
      Iterable.map(([, p]) => p),
      Iterable.filter((p) => connected.has(p.id)),
      (v) => Array.from(v),
    )
  }
  const enabled = () =>
    visibleEnabledProviders(connected(), {
      disabledProviderIDs: serverSync().data.config.disabled_providers ?? [],
      customProviderIDs: customProviderIDs(serverSync().data.config.provider),
    })
  return {
    all: () => providers().all,
    default: () => providers().default,
    popular: () => sortPopularProviders(Iterable.map(providers().all, ([, provider]) => provider)),
    connected,
    enabled,
    paid: () => {
      const enabledIDs = new Set(enabled().map((provider) => provider.id))
      return [
        ...Iterable.filter(
          providers().all,
          ([id]) =>
            enabledIDs.has(id) &&
            (id !== "opencode" || Object.values(providers().all.get(id)?.models ?? {}).some((m) => m.cost?.input)),
        ),
      ]
    },
  }
}
