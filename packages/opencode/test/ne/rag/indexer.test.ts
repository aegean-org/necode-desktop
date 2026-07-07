import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { NeRagIndexer } from "../../../src/ne/rag/indexer"
import { NeVectorStore } from "../../../src/ne/rag/vector-store"
import { buildTextPdf } from "./pdf-fixture"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function makeDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "opencode-rag-"))
  dirs.push(dir)
  return dir
}

describe("NeRagIndexer", () => {
  test("indexes supported text files into the vector store", async () => {
    const dir = makeDir()
    const docs = path.join(dir, "docs")
    mkdirSync(docs)
    writeFileSync(path.join(docs, "paper.md"), "alpha ".repeat(200), "utf8")
    writeFileSync(path.join(docs, "notes.txt"), "beta ".repeat(200), "utf8")
    writeFileSync(path.join(docs, "ignore.json"), "{}", "utf8")

    const progress: string[] = []
    const indexer = new NeRagIndexer({
      storePath: path.join(dir, "rag.db"),
      getApiKey: async () => "token",
      embedTexts: async (_apiKey, texts) => texts.map((_, index) => [index + 1, 0]),
    })

    const result = await indexer.indexPath(docs, {
      onProgress: (event) => progress.push(event.phase),
    })

    const store = new NeVectorStore(path.join(dir, "rag.db"))
    try {
      expect(result.files).toBe(2)
      expect(result.indexedFiles).toBe(2)
      expect(result.failedFiles).toBe(0)
      expect(
        store
          .listDocuments()
          .map((doc) => doc.title)
          .sort(),
      ).toEqual(["notes.txt", "paper.md"])
      expect(store.countChunks()).toBe(result.chunks)
      expect(progress).toContain("extracting")
      expect(progress).toContain("indexed")
    } finally {
      store.close()
    }
  })

  test("requires NE credentials before indexing", async () => {
    const dir = makeDir()
    writeFileSync(path.join(dir, "paper.md"), "alpha", "utf8")
    const indexer = new NeRagIndexer({
      storePath: path.join(dir, "rag.db"),
      getApiKey: async () => undefined,
      embedTexts: async () => [],
    })

    await expect(indexer.indexPath(dir)).rejects.toThrow("NE RAG indexing requires NE credentials")
  })

  test("indexes PDF files into the vector store", async () => {
    const dir = makeDir()
    const docs = path.join(dir, "docs")
    mkdirSync(docs)
    writeFileSync(path.join(docs, "paper.pdf"), buildTextPdf("PDF RAG index content"), "binary")
    const indexer = new NeRagIndexer({
      storePath: path.join(dir, "rag.db"),
      getApiKey: async () => "token",
      embedTexts: async (_apiKey, texts) => texts.map((_, index) => [index + 1, 0]),
    })

    const result = await indexer.indexPath(docs)

    const store = new NeVectorStore(path.join(dir, "rag.db"))
    try {
      expect(result.files).toBe(1)
      expect(result.indexedFiles).toBe(1)
      expect(result.failedFiles).toBe(0)
      expect(result.chunks).toBeGreaterThan(0)
      expect(store.listDocuments().map((doc) => doc.title)).toEqual(["paper.pdf"])
      expect(store.countChunks()).toBe(result.chunks)
    } finally {
      store.close()
    }
  })
})
