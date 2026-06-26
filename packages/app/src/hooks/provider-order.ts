export const popularProviders = [
  "ne",
  "opencode",
  "opencode-go",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]

const popularProviderRank = new Map(popularProviders.map((provider, index) => [provider, index]))

/**
 * Filters and sorts providers by the app's preferred popular-provider order.
 */
export function sortPopularProviders<T extends { id: string }>(providers: Iterable<T>) {
  return Array.from(providers)
    .filter((provider) => popularProviderRank.has(provider.id))
    .sort((a, b) => popularProviderRank.get(a.id)! - popularProviderRank.get(b.id)!)
}
