import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { NeVectorStore } from "../../../src/ne/rag/vector-store"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function makeStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "opencode-rag-"))
  dirs.push(dir)
  return new NeVectorStore(path.join(dir, "index.db"))
}

describe("NeVectorStore", () => {
  test("stores documents and returns chunks ordered by cosine similarity", () => {
    const store = makeStore()
    try {
      const alpha = store.upsertDocument({ filePath: path.join("docs", "alpha.md"), title: "Alpha Paper" })
      const beta = store.upsertDocument({ filePath: path.join("docs", "beta.md"), title: "Beta Paper" })

      store.replaceDocumentChunks(alpha.id, [{ chunkIndex: 0, text: "alpha chunk", vector: [1, 0] }])
      store.replaceDocumentChunks(beta.id, [{ chunkIndex: 0, text: "beta chunk", vector: [0, 1] }])

      const hits = store.search([1, 0], { topK: 2 })

      expect(hits.map((hit) => hit.docTitle)).toEqual(["Alpha Paper", "Beta Paper"])
      expect(hits[0]?.similarity).toBe(1)
      expect(store.countChunks()).toBe(2)
    } finally {
      store.close()
    }
  })

  test("lists and finds documents by title, path, and id", () => {
    const store = makeStore()
    try {
      const doc = store.upsertDocument({ filePath: path.join("refs", "paper-one.txt"), title: "Paper One" })
      store.replaceDocumentChunks(doc.id, [{ chunkIndex: 0, text: "content", vector: [1] }])

      expect(store.listDocuments()).toEqual([{ ...doc, chunks: 1 }])
      expect(store.findDocuments("paper-one", 5)).toEqual([{ ...doc, chunks: 1 }])
      expect(store.findDocuments(String(doc.id), 5)).toEqual([{ ...doc, chunks: 1 }])
    } finally {
      store.close()
    }
  })
})
