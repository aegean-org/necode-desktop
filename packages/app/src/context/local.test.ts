import { describe, expect, test } from "bun:test"
import { selectFallbackModel } from "./local-model"

const connected: Array<{ id: string; models: Record<string, { id: string }> }> = [
  {
    id: "ne",
    models: {
      "chat-a": { id: "chat-a" },
    },
  },
  {
    id: "anthropic",
    models: {
      "claude-sonnet-4": { id: "claude-sonnet-4" },
    },
  },
]

const valid = (model: { providerID: string; modelID: string }) =>
  connected.some((provider) => provider.id === model.providerID && provider.models[model.modelID])

describe("selectFallbackModel", () => {
  test("prefers explicit config over NE defaults", () => {
    expect(
      selectFallbackModel({
        configured: { providerID: "anthropic", modelID: "claude-sonnet-4" },
        connected,
        defaults: { ne: "chat-a" },
        recent: [],
        primaryProviderID: "ne",
        valid,
      }),
    ).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4" })
  })

  test("prefers NE default over stored recent models", () => {
    expect(
      selectFallbackModel({
        connected,
        defaults: { ne: "chat-a", anthropic: "claude-sonnet-4" },
        recent: [{ providerID: "anthropic", modelID: "claude-sonnet-4" }],
        primaryProviderID: "ne",
        valid,
      }),
    ).toEqual({ providerID: "ne", modelID: "chat-a" })
  })
})
