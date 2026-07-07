import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { collectNeRagContext } from "../../../src/ne/rag/context"
import { NeVectorStore } from "../../../src/ne/rag/vector-store"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function seededStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "opencode-rag-"))
  dirs.push(dir)
  const store = new NeVectorStore(path.join(dir, "index.db"))
  const paperOne = store.upsertDocument({ filePath: path.join(dir, "paper-one.md"), title: "Paper One" })
  const paperTwo = store.upsertDocument({ filePath: path.join(dir, "paper-two.md"), title: "Paper Two" })
  store.replaceDocumentChunks(paperOne.id, [{ chunkIndex: 0, text: "retrieved paper one chunk", vector: [1, 0] }])
  store.replaceDocumentChunks(paperTwo.id, [{ chunkIndex: 0, text: "retrieved paper two chunk", vector: [1, 0] }])
  return { store, paperOne, paperTwo }
}

describe("collectNeRagContext", () => {
  test("returns no context when the prompt does not contain a RAG mention", async () => {
    const { store } = seededStore()
    try {
      const context = await collectNeRagContext({
        prompt: "normal prompt",
        store,
        embedQuery: async () => [1, 0],
      })

      expect(context).toEqual({ userPrompt: "normal prompt", hits: [], selectedDocs: [] })
    } finally {
      store.close()
    }
  })

  test("retrieves snippets and builds a system prompt for @doc", async () => {
    const { store } = seededStore()
    try {
      const context = await collectNeRagContext({
        prompt: "summarize @doc",
        store,
        embedQuery: async (query) => {
          expect(query).toBe("summarize")
          return [1, 0]
        },
      })

      expect(context.userPrompt).toBe("summarize")
      expect(context.hits).toHaveLength(2)
      expect(context.systemPromptAppend).toContain("Local NE RAG snippets")
      expect(context.systemPromptAppend).toContain("retrieved paper one chunk")
    } finally {
      store.close()
    }
  })

  test("scopes retrieval to an explicitly mentioned document", async () => {
    const { store, paperOne } = seededStore()
    try {
      const context = await collectNeRagContext({
        prompt: 'summarize @doc:"Paper One"',
        store,
        embedQuery: async () => [1, 0],
      })

      expect(context.selectedDocs).toEqual([{ ...paperOne, chunks: 1 }])
      expect(context.hits.every((hit) => hit.docId === paperOne.id)).toBe(true)
      expect(context.systemPromptAppend).toContain("Do not cite documents outside this scope")
    } finally {
      store.close()
    }
  })

  test("throws explicit errors for missing or ambiguous scoped mentions", async () => {
    const { store } = seededStore()
    try {
      await expect(
        collectNeRagContext({
          prompt: "summarize @doc:missing",
          store,
          embedQuery: async () => [1, 0],
        }),
      ).rejects.toThrow("No indexed NE RAG document matched")

      await expect(
        collectNeRagContext({
          prompt: "summarize @doc:paper",
          store,
          embedQuery: async () => [1, 0],
        }),
      ).rejects.toThrow("Ambiguous indexed NE RAG document mention")
    } finally {
      store.close()
    }
  })
})
