import { describe, expect, test } from "bun:test"
import {
  customProviderIDs,
  providerAccountDescription,
  providerDisconnectLabel,
  shouldCloseProviderDialogAfterDisconnect,
  visibleEnabledProviders,
} from "./provider-account"

const t = (key: string, vars?: Record<string, string>) => `${key}:${vars?.account ?? ""}`

describe("provider account helpers", () => {
  test("uses NE account label when present", () => {
    expect(providerAccountDescription({ id: "ne", account: { label: "NE User" } }, t)).toBe(
      "settings.providers.connected.neAccount:NE User",
    )
  })

  test("uses sign out label for NE", () => {
    expect(providerDisconnectLabel({ id: "ne" }, t)).toBe("settings.providers.action.signOut:")
  })

  test("uses disable label for configured providers", () => {
    expect(providerDisconnectLabel({ id: "google-vertex", source: "custom" }, t)).toBe(
      "settings.providers.action.disable:",
    )
    expect(providerDisconnectLabel({ id: "vertex-anthropic", source: "config" }, t)).toBe(
      "settings.providers.action.disable:",
    )
  })

  test("uses disconnect label for API providers", () => {
    expect(providerDisconnectLabel({ id: "anthropic", source: "api" }, t)).toBe("common.disconnect:")
  })

  test("closes provider settings after NE signs out", () => {
    expect(shouldCloseProviderDialogAfterDisconnect("ne")).toBe(true)
    expect(shouldCloseProviderDialogAfterDisconnect("anthropic")).toBe(false)
  })

  test("hides disabled providers from enabled provider lists", () => {
    const providers = [{ id: "anthropic", source: "api" as const }, { id: "ne" }]

    expect(visibleEnabledProviders(providers, { disabledProviderIDs: ["anthropic"] })).toEqual([{ id: "ne" }])
  })

  test("only shows NE and explicitly linked providers in enabled provider lists", () => {
    const providers = [
      { id: "google-vertex", source: "custom" as const },
      { id: "google-vertex-anthropic", source: "custom" as const },
      { id: "openai", source: "env" as const },
      { id: "opencode", source: "custom" as const },
      { id: "ne", source: "custom" as const },
      { id: "anthropic", source: "api" as const },
    ]

    expect(visibleEnabledProviders(providers, { disabledProviderIDs: [] })).toEqual([
      { id: "ne", source: "custom" },
      { id: "anthropic", source: "api" },
    ])
  })

  test("allows auto-load capable providers after explicit API connection", () => {
    const providers = [
      { id: "ne", source: "custom" as const },
      { id: "google-vertex", source: "api" as const },
    ]

    expect(visibleEnabledProviders(providers, { disabledProviderIDs: [] })).toEqual([
      { id: "ne", source: "custom" },
      { id: "google-vertex", source: "api" },
    ])
  })

  test("keeps user-created custom config providers visible", () => {
    const providers = [
      { id: "team-docs", source: "config" as const },
      { id: "google-vertex", source: "config" as const },
      { id: "ne", source: "custom" as const },
    ]

    expect(
      visibleEnabledProviders(providers, {
        disabledProviderIDs: [],
        customProviderIDs: new Set(["team-docs"]),
      }),
    ).toEqual([
      { id: "ne", source: "custom" },
      { id: "team-docs", source: "config" },
    ])
  })

  test("extracts custom OpenAI-compatible config providers", () => {
    expect(
      customProviderIDs({
        "team-docs": {
          npm: "@ai-sdk/openai-compatible",
          models: {
            chat: {},
          },
        },
        "google-vertex": {
          npm: "@ai-sdk/google-vertex",
          models: {
            gemini: {},
          },
        },
      }),
    ).toEqual(new Set(["team-docs"]))
  })
})
