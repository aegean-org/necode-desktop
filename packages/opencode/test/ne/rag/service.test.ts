import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  importNeRagPath,
  NeRagCredentialRequiredError,
  NeRagImportFailedError,
  readNeRagStatus,
} from "../../../src/ne/rag/service"
import { NeVectorStore } from "../../../src/ne/rag/vector-store"

async function tempStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "opencode-rag-service-"))
  return { dir, storePath: path.join(dir, "index.db") }
}

describe("NE RAG service", () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  test("reports an empty status when the index database is missing", async () => {
    const store = await tempStore()
    cleanup.push(store.dir)

    await expect(readNeRagStatus(store.storePath)).resolves.toEqual({
      enabled: false,
      storePath: store.storePath,
      documents: [],
      chunks: 0,
    })
  })

  test("requires NE API credentials before importing", async () => {
    const store = await tempStore()
    cleanup.push(store.dir)

    await expect(
      importNeRagPath({
        inputPath: path.join(store.dir, "paper.pdf"),
        storePath: store.storePath,
        credential: undefined,
      }),
    ).rejects.toThrow(NeRagCredentialRequiredError)
  })

  test("imports through the provided indexer and returns refreshed status", async () => {
    const store = await tempStore()
    const source = path.join(store.dir, "paper.pdf")
    cleanup.push(store.dir)

    const result = await importNeRagPath({
      inputPath: source,
      storePath: store.storePath,
      credential: { type: "api", key: "test-key" },
      createIndexer: ({ storePath }) => ({
        async indexPath(inputPath) {
          const vectorStore = new NeVectorStore(storePath)
          try {
            const doc = vectorStore.upsertDocument({ filePath: inputPath, title: "paper.pdf" })
            vectorStore.replaceDocumentChunks(doc.id, [{ chunkIndex: 0, text: "content", vector: [1, 0] }])
            return { files: 1, indexedFiles: 1, failedFiles: 0, chunks: 1, failures: [] }
          } finally {
            vectorStore.close()
          }
        },
      }),
    })

    expect(result.importResult).toEqual({ files: 1, indexedFiles: 1, failedFiles: 0, chunks: 1, failures: [] })
    expect(result.status).toMatchObject({
      enabled: true,
      storePath: store.storePath,
      chunks: 1,
      documents: [{ filePath: source, title: "paper.pdf", chunks: 1 }],
    })
  })

  test("surfaces failed file imports instead of reporting success", async () => {
    const store = await tempStore()
    cleanup.push(store.dir)

    await expect(
      importNeRagPath({
        inputPath: path.join(store.dir, "broken.pdf"),
        storePath: store.storePath,
        credential: { type: "api", key: "test-key" },
        createIndexer: () => ({
          async indexPath(inputPath) {
            return {
              files: 1,
              indexedFiles: 0,
              failedFiles: 1,
              chunks: 0,
              failures: [{ filePath: inputPath, error: "PDF text extraction failed" }],
            }
          },
        }),
      }),
    ).rejects.toThrow(NeRagImportFailedError)
  })
})
