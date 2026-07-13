import type { Provider } from "@opencode-ai/sdk"
import type { Auth } from "@opencode-ai/sdk/v2"

type Rule = {
  key: string
  op: "eq" | "neq"
  value: string
}

type Prompt =
  | {
      type: "text"
      key: string
      message: string
      placeholder?: string
      validate?: (value: string) => string | undefined
      /** @deprecated Use `when` instead. */
      condition?: (inputs: Record<string, string>) => boolean
      when?: Rule
    }
  | {
      type: "select"
      key: string
      message: string
      options: Array<{ label: string; value: string; hint?: string }>
      /** @deprecated Use `when` instead. */
      condition?: (inputs: Record<string, string>) => boolean
      when?: Rule
    }

/** Provider authentication methods contributed by a plugin. */
export type AuthHook = {
  provider: string
  loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>
  methods: Array<
    | {
        type: "oauth"
        label: string
        prompts?: Prompt[]
        authorize(inputs?: Record<string, string>): Promise<AuthOAuthResult>
      }
    | {
        type: "api"
        label: string
        prompts?: Prompt[]
        authorize?(inputs?: Record<string, string>): Promise<
          | { type: "success"; key: string; provider?: string; metadata?: Record<string, string> }
          | { type: "failed" }
        >
      }
  >
}

/** Result returned by an OAuth authorization method. */
export type AuthOAuthResult = { url: string; instructions: string } & (
  | {
      method: "auto"
      callback(): Promise<AuthCallbackResult>
    }
  | {
      method: "code"
      callback(code: string): Promise<AuthCallbackResult>
    }
)

type AuthCallbackResult =
  | ({ type: "success"; provider?: string } & (
      | { refresh: string; access: string; expires: number; accountId?: string; enterpriseUrl?: string }
      | { key: string; metadata?: Record<string, string> }
    ))
  | { type: "failed" }

/** @deprecated Use AuthOAuthResult instead. */
export type AuthOuathResult = AuthOAuthResult
