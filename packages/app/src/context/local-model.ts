export type LocalModelKey = { providerID: string; modelID: string; variant?: string }

type LocalModelProvider = {
  id: string
  models: Record<string, { id: string }>
}

/**
 * Selects the automatic model fallback without overriding an explicit configured model.
 */
export function selectFallbackModel(input: {
  configured?: LocalModelKey
  recent: LocalModelKey[]
  defaults: Record<string, string | undefined>
  connected: LocalModelProvider[]
  primaryProviderID: string
  valid: (model: LocalModelKey) => boolean
}) {
  if (input.configured && input.valid(input.configured)) return input.configured

  const primary = input.connected.find((provider) => provider.id === input.primaryProviderID)
  const primaryModel = selectProviderDefault(primary, input.defaults, input.valid)
  if (primaryModel) return primaryModel

  for (const item of input.recent) {
    if (input.valid(item)) return item
  }

  for (const provider of input.connected) {
    const model = selectProviderDefault(provider, input.defaults, input.valid)
    if (model) return model
  }
}

function selectProviderDefault(
  provider: LocalModelProvider | undefined,
  defaults: Record<string, string | undefined>,
  valid: (model: LocalModelKey) => boolean,
) {
  if (!provider) return
  const configured = defaults[provider.id]
  if (configured) {
    const model = { providerID: provider.id, modelID: configured }
    if (valid(model)) return model
  }

  const first = Object.values(provider.models)[0]
  if (!first) return
  const model = { providerID: provider.id, modelID: first.id }
  if (valid(model)) return model
}
