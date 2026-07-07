import { existsSync } from "node:fs"
import { NE_PROVIDER_NAME } from "@/ne/constants"
import { resolveNeRagStorePath } from "./context"
import { NeRagIndexer, type NeRagIndexerOptions, type NeRagIndexResult } from "./indexer"
import { type NeDocument, NeVectorStore } from "./vector-store"

type NeApiCredential = { readonly type: "api"; readonly key: string }
type NeCredential = { readonly type: string; readonly key?: string }
type NeRagIndexerLike = { readonly indexPath: (inputPath: string) => Promise<NeRagIndexResult> }

export interface NeRagStatus {
  readonly enabled: boolean
  readonly storePath: string
  readonly documents: readonly NeDocument[]
  readonly chunks: number
}

export interface ImportNeRagPathOptions {
  readonly inputPath: string
  readonly credential: NeCredential | undefined
  readonly storePath?: string
  readonly createIndexer?: (options: NeRagIndexerOptions) => NeRagIndexerLike
}

export class NeRagCredentialRequiredError extends Error {
  constructor() {
    super(`NE RAG import requires ${NE_PROVIDER_NAME} credentials.`)
    this.name = "NeRagCredentialRequiredError"
  }
}

export class NeRagImportFailedError extends Error {
  readonly result: NeRagIndexResult

  constructor(result: NeRagIndexResult) {
    super(`NE RAG import failed for ${result.failedFiles} of ${result.files} file(s).`)
    this.name = "NeRagImportFailedError"
    this.result = result
  }
}

/** Reads the local NE RAG index summary without creating a new database file. */
export async function readNeRagStatus(storePath = resolveNeRagStorePath()): Promise<NeRagStatus> {
  if (!existsSync(storePath)) return { enabled: false, storePath, documents: [], chunks: 0 }
  const store = new NeVectorStore(storePath)
  try {
    return { enabled: true, storePath, documents: store.listDocuments(), chunks: store.countChunks() }
  } finally {
    store.close()
  }
}

/** Imports supported local files into the NE RAG index using real NE embeddings. */
export async function importNeRagPath(options: ImportNeRagPathOptions) {
  const credential = requireCredential(options.credential)
  const storePath = options.storePath ?? resolveNeRagStorePath()
  const createIndexer = options.createIndexer ?? ((input: NeRagIndexerOptions) => new NeRagIndexer(input))
  const importResult = await createIndexer({
    storePath,
    getApiKey: async () => credential.key,
  }).indexPath(options.inputPath)
  if (importResult.failedFiles > 0) throw new NeRagImportFailedError(importResult)
  return { importResult, status: await readNeRagStatus(storePath) }
}

function requireCredential(credential: NeCredential | undefined): NeApiCredential {
  if (credential?.type === "api" && credential.key) return { type: "api", key: credential.key }
  throw new NeRagCredentialRequiredError()
}
