import { basename } from "node:path"
import { NE_PROVIDER_NAME } from "@/ne/constants"
import { embedNeTexts } from "./embedding"
import { chunkNeRagText, extractNeRagText, scanNeRagFiles } from "./text"
import { NeVectorStore } from "./vector-store"

export type NeRagApiKeyProvider = () => Promise<string | undefined>
export type NeRagEmbedTexts = (
  apiKey: string,
  texts: readonly string[],
  signal?: AbortSignal,
) => Promise<readonly (readonly number[])[]>

export interface NeRagIndexerOptions {
  readonly storePath: string
  readonly getApiKey: NeRagApiKeyProvider
  readonly embedTexts?: NeRagEmbedTexts
}

export interface NeRagIndexFailure {
  readonly filePath: string
  readonly error: string
}

export interface NeRagIndexProgress {
  readonly filePath: string
  readonly fileIndex: number
  readonly totalFiles: number
  readonly phase: "extracting" | "embedding" | "writing" | "indexed" | "failed"
  readonly chunks?: number
  readonly error?: string
}

export interface NeRagIndexPathOptions {
  readonly onProgress?: (progress: NeRagIndexProgress) => void
  readonly signal?: AbortSignal
}

export interface NeRagIndexResult {
  readonly files: number
  readonly indexedFiles: number
  readonly failedFiles: number
  readonly chunks: number
  readonly failures: readonly NeRagIndexFailure[]
}

export class NeRagIndexer {
  private readonly storePath: string
  private readonly getApiKey: NeRagApiKeyProvider
  private readonly embedTexts: NeRagEmbedTexts

  constructor(options: NeRagIndexerOptions) {
    this.storePath = options.storePath
    this.getApiKey = options.getApiKey
    this.embedTexts = options.embedTexts ?? embedTextsWithNe
  }

  async indexPath(inputPath: string, options: NeRagIndexPathOptions = {}) {
    const apiKey = await this.getApiKey()
    if (!apiKey) throw new Error(`NE RAG indexing requires ${NE_PROVIDER_NAME} credentials.`)
    const files = await scanNeRagFiles(inputPath)
    const store = new NeVectorStore(this.storePath)
    try {
      return await this.indexFiles(store, files, apiKey, options)
    } finally {
      store.close()
    }
  }

  private async indexFiles(
    store: NeVectorStore,
    files: readonly string[],
    apiKey: string,
    options: NeRagIndexPathOptions,
  ): Promise<NeRagIndexResult> {
    const results: Array<
      { readonly ok: true; readonly chunks: number } | { readonly ok: false; readonly failure: NeRagIndexFailure }
    > = []
    for (const [index, filePath] of files.entries()) {
      results.push(await this.tryIndexFile(store, filePath, apiKey, { index, total: files.length }, options))
    }
    const successes = results.filter((result): result is { readonly ok: true; readonly chunks: number } => result.ok)
    const failures = results.flatMap((result) => (result.ok ? [] : [result.failure]))
    return {
      files: files.length,
      indexedFiles: successes.length,
      failedFiles: failures.length,
      chunks: successes.reduce((sum, result) => sum + result.chunks, 0),
      failures,
    }
  }

  private async tryIndexFile(
    store: NeVectorStore,
    filePath: string,
    apiKey: string,
    state: { readonly index: number; readonly total: number },
    options: NeRagIndexPathOptions,
  ) {
    try {
      return { ok: true as const, chunks: await this.indexFile(store, filePath, apiKey, state, options) }
    } catch (error) {
      const failure = { filePath, error: error instanceof Error ? error.message : String(error) }
      reportProgress(options.onProgress, state, filePath, { phase: "failed", error: failure.error })
      return { ok: false as const, failure }
    }
  }

  private async indexFile(
    store: NeVectorStore,
    filePath: string,
    apiKey: string,
    state: { readonly index: number; readonly total: number },
    options: NeRagIndexPathOptions,
  ) {
    reportProgress(options.onProgress, state, filePath, { phase: "extracting" })
    const chunks = chunkNeRagText(await extractNeRagText(filePath, options.signal))
    if (chunks.length === 0) throw new Error(`No text extracted from ${filePath}`)
    reportProgress(options.onProgress, state, filePath, { phase: "embedding", chunks: chunks.length })
    const vectors = await this.embedTexts(apiKey, chunks, options.signal)
    if (vectors.length !== chunks.length) {
      throw new Error(`NE RAG embedding returned ${vectors.length} vectors for ${chunks.length} chunks.`)
    }
    const doc = store.upsertDocument({ filePath, title: basename(filePath) })
    reportProgress(options.onProgress, state, filePath, { phase: "writing", chunks: chunks.length })
    store.replaceDocumentChunks(
      doc.id,
      chunks.map((chunk, index) => ({ chunkIndex: index, text: chunk, vector: requireVector(vectors, index) })),
    )
    reportProgress(options.onProgress, state, filePath, { phase: "indexed", chunks: chunks.length })
    return chunks.length
  }
}

function requireVector(vectors: readonly (readonly number[])[], index: number) {
  const vector = vectors[index]
  if (!vector) throw new Error(`NE RAG embedding vector ${index + 1} is missing.`)
  return vector
}

function reportProgress(
  onProgress: ((progress: NeRagIndexProgress) => void) | undefined,
  state: { readonly index: number; readonly total: number },
  filePath: string,
  progress: Pick<NeRagIndexProgress, "phase" | "chunks" | "error">,
) {
  onProgress?.({ filePath, fileIndex: state.index + 1, totalFiles: state.total, ...progress })
}

async function embedTextsWithNe(apiKey: string, texts: readonly string[], signal?: AbortSignal) {
  return embedNeTexts({ apiKey, texts, signal })
}
