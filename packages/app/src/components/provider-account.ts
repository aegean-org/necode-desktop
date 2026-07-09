import type { ProviderSource } from "@/hooks/provider-visibility"

export { customProviderIDs, visibleEnabledProviders } from "@/hooks/provider-visibility"

type Translate = (key: string, vars?: Record<string, string>) => string

type ProviderWithAccount = {
  id: string
  source?: ProviderSource
  account?: {
    label: string
  }
}

const NE_PROVIDER_ID = "ne"

/**
 * Returns the account text shown for a connected provider row.
 */
export function providerAccountDescription(provider: ProviderWithAccount, t: Translate) {
  if (provider.id !== NE_PROVIDER_ID || !provider.account?.label) return
  return t("settings.providers.connected.neAccount", { account: provider.account.label })
}

/**
 * Returns the row action label for an enabled provider.
 */
export function providerDisconnectLabel(provider: Pick<ProviderWithAccount, "id" | "source">, t: Translate) {
  if (provider.id === NE_PROVIDER_ID) return t("settings.providers.action.signOut")
  if (provider.source === "config" || provider.source === "custom") return t("settings.providers.action.disable")
  return t("common.disconnect")
}

/**
 * Returns whether a successful disconnect should dismiss the current settings dialog.
 */
export function shouldCloseProviderDialogAfterDisconnect(providerID: string) {
  return providerID === NE_PROVIDER_ID
}
