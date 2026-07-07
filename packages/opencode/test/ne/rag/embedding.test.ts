import { describe, expect, test } from "bun:test"
import { NE_DEFAULT_EMBEDDING_MODEL, NE_GATEWAY_BASE_URL } from "../../../src/ne/constants"
import { embedNeTexts } from "../../../src/ne/rag/embedding"

describe("embedNeTexts", () => {
  test("calls the NE gateway embeddings endpoint with the NE embedding model", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const vectors = await embedNeTexts({
      apiKey: "token",
      texts: ["hello"],
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }))
      },
    })

    expect(vectors).toEqual([[1, 2, 3]])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${NE_GATEWAY_BASE_URL}/embeddings`)
    expect(calls[0]?.init?.method).toBe("POST")
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer necli##token")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      model: NE_DEFAULT_EMBEDDING_MODEL,
      input: ["hello"],
    })
  })

  test("throws when the NE embedding response vector count does not match inputs", async () => {
    await expect(
      embedNeTexts({
        apiKey: "token",
        texts: ["one", "two"],
        fetchImpl: async () => new Response(JSON.stringify({ data: [{ embedding: [1] }] })),
      }),
    ).rejects.toThrow("returned 1 vectors for 2 inputs")
  })
})
