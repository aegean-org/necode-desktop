import { expect, test } from "bun:test"
import { NE_LOGIN_EXPIRE_SECONDS, NE_PUBLIC_KEY_URL } from "../../src/ne/constants"
import { loginToNe } from "../../src/ne/auth"

test("loginToNe fetches public key and posts encrypted password", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    calls.push({ url, init })
    if (url === NE_PUBLIC_KEY_URL) {
      return Response.json({ data: { public_key: "PUBLIC" } })
    }
    return Response.json({ code: 0, data: { token: "AUT" } })
  }

  const result = await loginToNe({
    username: "user@example.com",
    password: "plain",
    fetcher,
    encryptPassword: (password, publicKey) => `${publicKey}:${password}:encrypted`,
  })

  expect(result.token).toBe("AUT")
  expect(calls.map((call) => call.url)).toEqual([
    NE_PUBLIC_KEY_URL,
    "http://uc.inoteexpress.com/user/passwordlogin",
  ])
  const body = calls[1]?.init?.body
  expect(body).toBeInstanceOf(URLSearchParams)
  const params = body as URLSearchParams
  expect(params.get("target")).toBe("user@example.com")
  expect(params.get("password")).toBe("PUBLIC:plain:encrypted")
  expect(params.get("expire")).toBe(String(NE_LOGIN_EXPIRE_SECONDS))
})

test("loginToNe exposes failed login messages", async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (url === NE_PUBLIC_KEY_URL) {
      return Response.json({ data: { public_key: "PUBLIC" } })
    }
    return Response.json({ code: 400, message: "bad password" })
  }

  await expect(
    loginToNe({
      username: "user@example.com",
      password: "plain",
      fetcher,
      encryptPassword: () => "encrypted",
    }),
  ).rejects.toThrow("bad password")
})
