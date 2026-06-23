import type { Config, Plugin } from "@opencode-ai/plugin"
import { NE_PROVIDER_ID } from "./constants"
import { loginToNe } from "./auth"
import { fetchNeModels } from "./models"
import { withNeDefaultMcp } from "./mcp"

export const NePlugin: Plugin = async () => ({
  config: async (config) => {
    ensureNeProvider(config)
  },
  auth: {
    provider: NE_PROVIDER_ID,
    methods: [
      {
        type: "api",
        label: "NE account",
        prompts: [
          {
            type: "text",
            key: "username",
            message: "NE account",
            placeholder: "Email or mobile",
            validate: required("NE account is required."),
          },
          {
            type: "text",
            key: "password",
            message: "NE password",
            validate: required("NE password is required."),
          },
        ],
        authorize: async (inputs) => {
          const result = await loginToNe({
            username: inputs?.username ?? "",
            password: inputs?.password ?? "",
          })
          return {
            type: "success",
            key: result.token,
            provider: NE_PROVIDER_ID,
            metadata: {
              ...(result.accountId ? { accountId: result.accountId } : {}),
              ...(result.displayName ? { displayName: result.displayName } : {}),
            },
          }
        },
      },
    ],
  },
  provider: {
    id: NE_PROVIDER_ID,
    models: async (_provider, ctx) => {
      if (ctx.auth?.type !== "api") return {}
      return fetchNeModels(ctx.auth.key)
    },
  },
})

function ensureNeProvider(config: Config) {
  config.mcp = withNeDefaultMcp(config.mcp ?? {})
}

function required(message: string) {
  return (value: string) => (value.trim() === "" ? message : undefined)
}
