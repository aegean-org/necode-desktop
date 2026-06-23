import { expect } from "bun:test"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { Effect, Layer } from "effect"
import { Auth } from "../../src/auth"
import { Plugin } from "../../src/plugin"
import { ProviderAuth } from "../../src/provider/auth"
import { testEffect } from "../lib/effect"

const stored = new Map<string, Auth.Info>()

const authLayer = Layer.succeed(
  Auth.Service,
  Auth.Service.of({
    get: (providerID) => Effect.succeed(stored.get(providerID)),
    all: () => Effect.succeed(Object.fromEntries(stored)),
    set: (providerID, info) =>
      Effect.sync(() => {
        stored.set(providerID, info)
      }),
    remove: (providerID) =>
      Effect.sync(() => {
        stored.delete(providerID)
      }),
  }),
)

const pluginLayer = Layer.succeed(
  Plugin.Service,
  Plugin.Service.of({
    init: () => Effect.void,
    list: () =>
      Effect.succeed([
        {
          auth: {
            provider: "ne",
            methods: [
              {
                type: "api",
                label: "NE account",
                authorize: async (inputs) => ({
                  type: "success",
                  key: "AUT",
                  provider: "ne",
                  metadata: { username: inputs?.username ?? "" },
                }),
              },
            ],
          },
        },
      ]),
    trigger: (_name, _input, output) => Effect.succeed(output),
  }),
)

const it = testEffect(ProviderAuth.layer.pipe(Layer.provide(authLayer), Layer.provide(pluginLayer)))

it.instance("ProviderAuth.authorize stores successful api method credentials", () =>
  Effect.gen(function* () {
    stored.clear()
    yield* ProviderAuth.use.authorize({
      providerID: ProviderV2.ID.make("ne"),
      method: 0,
      inputs: { username: "alice" },
    })

    expect(stored.get("ne")).toEqual({
      type: "api",
      key: "AUT",
      metadata: { username: "alice" },
    })
  }),
)
