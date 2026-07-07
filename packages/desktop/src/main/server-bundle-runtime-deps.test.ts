import { describe, expect, test } from "bun:test"

const MARKIT_AI_VERSION = "0.5.3"

describe("desktop server bundle runtime dependencies", () => {
  test("declares the dynamic RAG PDF converter dependency", async () => {
    const pkg = (await Bun.file(new URL("../../package.json", import.meta.url)).json()) as {
      dependencies?: Record<string, string>
    }

    expect(pkg.dependencies?.["markit-ai"]).toBe(MARKIT_AI_VERSION)
  })
})
