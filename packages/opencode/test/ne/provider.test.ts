import { afterEach, expect, spyOn } from "bun:test"
import { rm } from "fs/promises"
import { ModelV2 } from "@opencode-ai/core/model"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import path from "path"
import { Effect, Layer } from "effect"
import { Auth } from "../../src/auth"
import { Config } from "../../src/config/config"
import { Env } from "../../src/env"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { NE_MODELS_URL, NE_PROVIDER_ID } from "../../src/ne/constants"
import { Plugin } from "../../src/plugin"
import { Provider } from "../../src/provider/provider"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

let fetchSpy: ReturnType<typeof spyOn> | undefined
const originalAuthContent = process.env.OPENCODE_AUTH_CONTENT

afterEach(async () => {
  fetchSpy?.mockRestore()
  fetchSpy = undefined
  if (originalAuthContent === undefined) delete process.env.OPENCODE_AUTH_CONTENT
  else process.env.OPENCODE_AUTH_CONTENT = originalAuthContent
  await rm(path.join(Global.Path.data, "auth.json"), { force: true })
  await rm(path.join(Global.Path.state, "model.json"), { force: true })
  await disposeAllInstances()
})

const providerLayer = Provider.layer.pipe(
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(Auth.defaultLayer),
  Layer.provide(Plugin.defaultLayer),
  Layer.provide(ModelsDev.defaultLayer),
  Layer.provide(RuntimeFlags.defaultLayer),
)

const it = testEffect(providerLayer)

it.instance("NE provider loads models from gateway with stored auth", () =>
  Effect.gen(function* () {
    process.env.OPENCODE_AUTH_CONTENT = JSON.stringify({
      [NE_PROVIDER_ID]: {
        type: "api",
        key: "AUT",
        metadata: {
          accountId: "u-1",
          displayName: "NE User",
        },
      },
    })
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (input: string | URL | Request, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : input.toString()
          expect(url).toBe(NE_MODELS_URL)
          expect(init?.headers).toEqual({
            accept: "application/json",
            Authorization: "Bearer necli##AUT",
          })
          return Response.json({ data: [{ id: "chat-a", name: "Chat A" }] })
        },
        { preconnect() {} },
      ) as typeof fetch,
    )

    const providers = yield* Provider.use.list()
    const provider = providers[ProviderV2.ID.make(NE_PROVIDER_ID)]

    expect(provider.name).toBe("NE")
    expect(provider.account).toEqual({ id: "u-1", label: "NE User" })
    expect(provider.options.apiKey).toBe("necli##AUT")
    expect(provider.models[ModelV2.ID.make("chat-a")].name).toBe("Chat A")
  }),
)

it.instance("default model prefers NE when NE auth is present", () =>
  Effect.gen(function* () {
    process.env.OPENCODE_AUTH_CONTENT = JSON.stringify({
      [NE_PROVIDER_ID]: { type: "api", key: "AUT" },
    })
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async () => Response.json({ data: [{ id: "chat-a", name: "Chat A" }] }),
        { preconnect() {} },
      ) as typeof fetch,
    )

    const model = yield* Provider.use.defaultModel()

    expect(String(model.providerID)).toBe(NE_PROVIDER_ID)
    expect(String(model.modelID)).toBe("chat-a")
  }),
  15_000,
)

it.instance("default model prefers NE over stored recent models", () =>
  Effect.gen(function* () {
    process.env.OPENCODE_AUTH_CONTENT = JSON.stringify({
      anthropic: { type: "api", key: "ANT" },
      [NE_PROVIDER_ID]: { type: "api", key: "AUT" },
    })
    yield* Effect.promise(() =>
      Bun.write(
        path.join(Global.Path.state, "model.json"),
        JSON.stringify({
          recent: [{ providerID: "anthropic", modelID: "claude-sonnet-4-20250514" }],
        }),
      ),
    )
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async () => Response.json({ data: [{ id: "chat-a", name: "Chat A" }] }),
        { preconnect() {} },
      ) as typeof fetch,
    )

    const model = yield* Provider.use.defaultModel()

    expect(String(model.providerID)).toBe(NE_PROVIDER_ID)
    expect(String(model.modelID)).toBe("chat-a")
  }),
  15_000,
)

it.instance("removes NE auth when model dictionary returns unauthorized", () =>
  Effect.gen(function* () {
    const authFile = path.join(Global.Path.data, "auth.json")
    yield* Effect.promise(() => Bun.write(authFile, JSON.stringify({ [NE_PROVIDER_ID]: { type: "api", key: "BAD" } })))
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async () => new Response("expired", { status: 401, statusText: "Unauthorized" }),
        { preconnect() {} },
      ) as typeof fetch,
    )

    const providers = yield* Provider.use.list()
    const stored = yield* Effect.promise(() => Bun.file(authFile).json())

    expect(providers[ProviderV2.ID.make(NE_PROVIDER_ID)]).toBeUndefined()
    expect(stored).toEqual({})
  }),
)
