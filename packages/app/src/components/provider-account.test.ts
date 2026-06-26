import { describe, expect, test } from "bun:test"
import { providerAccountDescription, providerDisconnectLabel } from "./provider-account"

const t = (key: string, vars?: Record<string, string>) => `${key}:${vars?.account ?? ""}`

describe("provider account helpers", () => {
  test("uses NE account label when present", () => {
    expect(providerAccountDescription({ id: "ne", account: { label: "NE User" } }, t)).toBe(
      "settings.providers.connected.neAccount:NE User",
    )
  })

  test("uses switch account label for NE", () => {
    expect(providerDisconnectLabel("ne", t)).toBe("settings.providers.action.switchAccount:")
  })
})
