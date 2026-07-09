export const popularProviders = [
  "ne",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]

const popularProviderRank = new Map(popularProviders.map((provider, index) => [provider, index]))
const hiddenConnectableProviders = new Set(["opencode", "opencode-go"])

/**
 * Returns whether a provider should be exposed in provider connection surfaces.
 */
export function isConnectableProvider(providerID: string) {
  return !hiddenConnectableProviders.has(providerID)
}

/**
 * Filters and sorts providers by the app's preferred popular-provider order.
 */
export function sortPopularProviders<T extends { id: string }>(providers: Iterable<T>) {
  return Array.from(providers)
    .filter((provider) => isConnectableProvider(provider.id) && popularProviderRank.has(provider.id))
    .sort((a, b) => popularProviderRank.get(a.id)! - popularProviderRank.get(b.id)!)
}
