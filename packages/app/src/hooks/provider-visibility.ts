export type ProviderSource = "env" | "api" | "config" | "custom"

type ProviderVisibilityItem = {
  id: string
  source?: ProviderSource
}

type ProviderConfig = {
  npm?: string
  models?: Record<string, unknown>
}

type ProviderVisibilityOptions = {
  disabledProviderIDs: readonly string[]
  customProviderIDs?: ReadonlySet<string>
}

const NE_PROVIDER_ID = "ne"
const SORT_BEFORE = -1
const SORT_AFTER = 1
const SORT_EQUAL = 0
const hiddenProductProviderIDs = new Set(["opencode", "opencode-go"])
const autoLoadProviderIDs = new Set(["google-vertex", "google-vertex-anthropic"])

/**
 * Extracts provider ids created through the app's OpenAI-compatible custom-provider flow.
 */
export function customProviderIDs(configProviders: Record<string, ProviderConfig> | undefined) {
  return new Set(
    Object.entries(configProviders ?? {})
      .filter(([, provider]) => provider.npm === "@ai-sdk/openai-compatible")
      .filter(([, provider]) => Object.keys(provider.models ?? {}).length > 0)
      .map(([providerID]) => providerID),
  )
}

/**
 * Filters backend-connected providers down to providers enabled by explicit product action.
 */
export function visibleEnabledProviders<T extends ProviderVisibilityItem>(
  providers: readonly T[],
  options: ProviderVisibilityOptions,
) {
  const disabled = new Set(options.disabledProviderIDs)
  return providers.filter((provider) => isVisibleEnabledProvider(provider, disabled, options)).sort(enabledProviderSort)
}

function isVisibleEnabledProvider(
  provider: ProviderVisibilityItem,
  disabled: ReadonlySet<string>,
  options: ProviderVisibilityOptions,
) {
  if (disabled.has(provider.id)) return false
  if (hiddenProductProviderIDs.has(provider.id)) return false
  if (autoLoadProviderIDs.has(provider.id) && !isExplicitAutoLoadProvider(provider, options)) return false
  if (provider.id === NE_PROVIDER_ID) return true
  return isExplicitProvider(provider, options)
}

function isExplicitAutoLoadProvider(provider: ProviderVisibilityItem, options: ProviderVisibilityOptions) {
  if (provider.source === "api") return true
  return provider.source === "config" && !!options.customProviderIDs?.has(provider.id)
}

function isExplicitProvider(provider: ProviderVisibilityItem, options: ProviderVisibilityOptions) {
  if (provider.source === "api" || provider.source === "custom") return true
  return provider.source === "config" && !!options.customProviderIDs?.has(provider.id)
}

function enabledProviderSort(left: { id: string }, right: { id: string }) {
  if (left.id === NE_PROVIDER_ID && right.id !== NE_PROVIDER_ID) return SORT_BEFORE
  if (left.id !== NE_PROVIDER_ID && right.id === NE_PROVIDER_ID) return SORT_AFTER
  return SORT_EQUAL
}
