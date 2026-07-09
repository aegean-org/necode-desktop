import type { ProviderAuthMethod, ProviderAuthResponse } from "@opencode-ai/sdk/v2/client"

export const NE_PROVIDER_ID = "ne"

type NeAuthLoadResult = {
  methods: ProviderAuthMethod[]
  error?: string
}

/**
 * Converts NE-owned auth prompt text from server defaults into current UI language text.
 */
export function translateNeAuthMethod(input: {
  method: ProviderAuthMethod
  accountLabel: string
  accountPlaceholder: string
  passwordLabel: string
}) {
  if (input.method.type !== "api") return input.method
  return {
    ...input.method,
    label: input.accountLabel,
    prompts: input.method.prompts?.map((prompt) => {
      if (prompt.type !== "text") return prompt
      if (prompt.key === "username") {
        return {
          ...prompt,
          message: input.accountLabel,
          placeholder: input.accountPlaceholder,
        }
      }
      if (prompt.key === "password") return { ...prompt, message: input.passwordLabel }
      return prompt
    }),
  }
}

/**
 * Loads NE provider auth methods without letting transient server errors crash app startup.
 */
export async function loadNeAuthMethods(input: {
  cached: ProviderAuthMethod[] | undefined
  fetchAuth: () => Promise<{ data?: ProviderAuthResponse }>
  setProviderAuth: (auth: ProviderAuthResponse) => void
  formatError: (error: unknown) => string
}): Promise<NeAuthLoadResult> {
  if (input.cached) return { methods: input.cached }
  try {
    const result = await input.fetchAuth()
    const auth = result.data ?? {}
    input.setProviderAuth(auth)
    return { methods: auth[NE_PROVIDER_ID] ?? [] }
  } catch (error) {
    return { methods: [], error: input.formatError(error) }
  }
}
