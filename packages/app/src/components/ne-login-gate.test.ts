import { expect, test } from "bun:test"
import { loadNeAuthMethods, translateNeAuthMethod } from "./ne-login-gate-auth"
import { neLoginSubmitLabel } from "./ne-login-gate-labels"

const t = (key: string) => `${key}:`

test("loadNeAuthMethods returns cached NE methods without requesting the server", async () => {
  const cached = [{ type: "api" as const, label: "NE", prompts: [] }]
  let requested = false

  const result = await loadNeAuthMethods({
    cached,
    fetchAuth: async () => {
      requested = true
      return { data: {} }
    },
    setProviderAuth() {},
    formatError: String,
  })

  expect(result).toEqual({ methods: cached })
  expect(requested).toBe(false)
})

test("loadNeAuthMethods exposes provider auth failures without throwing", async () => {
  let stored: unknown

  const result = await loadNeAuthMethods({
    cached: undefined,
    fetchAuth: async () => {
      throw new Error("provider auth unavailable")
    },
    setProviderAuth(auth) {
      stored = auth
    },
    formatError: (error) => (error instanceof Error ? error.message : String(error)),
  })

  expect(result).toEqual({ methods: [], error: "provider auth unavailable" })
  expect(stored).toBeUndefined()
})

test("translateNeAuthMethod localizes NE login prompts", () => {
  const method = {
    type: "api" as const,
    label: "NE account",
    prompts: [
      { type: "text" as const, key: "username", message: "NE account", placeholder: "Email or mobile" },
      { type: "text" as const, key: "password", message: "NE password" },
    ],
  }

  expect(
    translateNeAuthMethod({
      method,
      accountLabel: "NE 账号",
      accountPlaceholder: "邮箱或手机号",
      passwordLabel: "NE 密码",
    }),
  ).toEqual({
    type: "api",
    label: "NE 账号",
    prompts: [
      { type: "text", key: "username", message: "NE 账号", placeholder: "邮箱或手机号" },
      { type: "text", key: "password", message: "NE 密码" },
    ],
  })
})

test("neLoginSubmitLabel uses login progress wording while pending", () => {
  expect(neLoginSubmitLabel(false, t)).toBe("ne.login.submit:")
  expect(neLoginSubmitLabel(true, t)).toBe("ne.login.signingIn:")
})
