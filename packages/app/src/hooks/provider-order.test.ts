import { expect, test } from "bun:test"
import { sortPopularProviders } from "./provider-order"

test("sortPopularProviders puts NE before other popular providers", () => {
  const providers = [
    { id: "openai" },
    { id: "opencode" },
    { id: "ne" },
    { id: "opencode-go" },
    { id: "anthropic" },
    { id: "unknown" },
  ]

  expect(sortPopularProviders(providers).map((provider) => provider.id)).toEqual(["ne", "anthropic", "openai"])
})
