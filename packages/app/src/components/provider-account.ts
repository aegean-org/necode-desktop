type Translate = (key: string, vars?: Record<string, string>) => string

type ProviderWithAccount = {
  id: string
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
 * Returns the disconnect button label with NE account switching semantics.
 */
export function providerDisconnectLabel(providerID: string, t: Translate) {
  if (providerID === NE_PROVIDER_ID) return t("settings.providers.action.switchAccount")
  return t("common.disconnect")
}
