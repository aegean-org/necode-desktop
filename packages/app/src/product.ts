/** Central product destinations used by user-visible app entry points. */
export const PRODUCT_HOME_URL = "https://necode.ai"
export const PRODUCT_DOCS_URL = `${PRODUCT_HOME_URL}/docs`
export const PRODUCT_THEME_DOCS_URL = `${PRODUCT_DOCS_URL}/themes/`
export const PRODUCT_CUSTOM_PROVIDER_DOCS_URL = `${PRODUCT_DOCS_URL}/providers/#custom-provider`
export const PRODUCT_ZEN_URL = `${PRODUCT_HOME_URL}/zen`

const PRODUCT_PROVIDER_NAMES: Record<string, string> = {
  opencode: "NeCode Zen",
  "opencode-go": "NeCode Go",
}

/** Returns the user-visible provider name without changing provider identifiers. */
export function productProviderName(providerID: string, fallback: string) {
  return PRODUCT_PROVIDER_NAMES[providerID] ?? fallback
}
