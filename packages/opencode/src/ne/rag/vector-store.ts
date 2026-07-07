import { openNeRagSqlite } from "#ne-rag-sqlite"
import { mkdirSync } from "node:fs"
import { basename, dirname, extname } from "node:path"
import type { NeRagSqliteDatabase, NeRagSqliteStatement } from "./sqlite-types"

export interface NeDocument {
  readonly id: number
  readonly filePath: string
  readonly title: string
  readonly chunks: number
}

export interface NeChunkInput {
  readonly chunkIndex: number
  readonly text: string
  readonly vector: readonly number[]
}

export interface NeSearchHit {
  readonly docId: number
  readonly docTitle: string
  readonly filePath: string
  readonly chunkIndex: number
  readonly text: string
  readonly similarity: number
}

interface DocumentRow {
  readonly id: number
  readonly file_path: string
  readonly title: string
  readonly chunks: number
}

interface ChunkRow {
  readonly doc_id: number
  readonly file_path: string
  readonly chunk_idx: number
  readonly text: string
  readonly vector: unknown
  readonly dim: number
  readonly doc_title: string | null
}

export class NeVectorStore {
  private readonly db: NeRagSqliteDatabase

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = openNeRagSqlite(dbPath)
    this.ensureSchema()
  }

  close() {
    this.db.close()
  }

  countChunks() {
    const row = withStatement(this.db.prepare("SELECT COUNT(*) AS count FROM chunks"), (stmt) => stmt.get()) as
      | { count?: number }
      | undefined
    if (typeof row?.count !== "number") throw new Error("SQLite count query returned no row.")
    return row.count
  }

  upsertDocument(input: { readonly filePath: string; readonly title?: string }) {
    const now = Date.now()
    const title = input.title ?? titleFromPath(input.filePath)
    withStatement(
      this.db.prepare(
        `INSERT INTO docs (file_path, title, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(file_path) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
      ),
      (stmt) => stmt.run(input.filePath, title, now, now),
    )
    return this.getDocumentByPath(input.filePath)
  }

  replaceDocumentChunks(docId: number, chunks: readonly NeChunkInput[]) {
    const doc = this.getDocumentById(docId)
    const insert = this.db.prepare(
      `INSERT INTO chunks (doc_id, file_path, chunk_idx, text, vector, dim, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const remove = this.db.prepare("DELETE FROM chunks WHERE doc_id = ?")
    try {
      this.db.transaction(() => {
        remove.run(docId)
        for (const chunk of chunks) {
          insert.run(
            doc.id,
            doc.filePath,
            chunk.chunkIndex,
            chunk.text,
            vectorToBuffer(chunk.vector),
            chunk.vector.length,
            Date.now(),
          )
        }
      })
    } finally {
      insert.finalize()
      remove.finalize()
    }
  }

  search(queryVector: readonly number[], options: { readonly topK?: number; readonly docId?: number } = {}) {
    const hits = this.loadSearchRows(options.docId).map((row) => scoreRow(row, queryVector))
    hits.sort((a, b) => b.similarity - a.similarity)
    return hits.slice(0, options.topK ?? 5)
  }

  findDocuments(term: string, limit: number) {
    const docId = /^\d+$/u.test(term) ? Number.parseInt(term, 10) : -1
    const like = `%${term.toLowerCase()}%`
    const rows = withStatement(
      this.db.prepare(
        `SELECT d.id, d.file_path, d.title, COUNT(c.id) AS chunks
         FROM docs d
         LEFT JOIN chunks c ON c.doc_id = d.id
         WHERE d.id = ? OR lower(d.title) LIKE ? OR lower(d.file_path) LIKE ?
         GROUP BY d.id
         ORDER BY d.updated_at DESC
         LIMIT ?`,
      ),
      (stmt) => stmt.all(docId, like, like, limit),
    ) as DocumentRow[]
    return rows.map(toDocument)
  }

  listDocuments() {
    const rows = withStatement(
      this.db.prepare(
        `SELECT d.id, d.file_path, d.title, COUNT(c.id) AS chunks
         FROM docs d
         LEFT JOIN chunks c ON c.doc_id = d.id
         GROUP BY d.id
         ORDER BY d.file_path`,
      ),
      (stmt) => stmt.all(),
    ) as DocumentRow[]
    return rows.map(toDocument)
  }

  private ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        chunk_idx INTEGER NOT NULL,
        text TEXT NOT NULL,
        vector BLOB NOT NULL,
        dim INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ne_rag_chunks_doc ON chunks(doc_id);
      CREATE INDEX IF NOT EXISTS idx_ne_rag_chunks_file ON chunks(file_path);
    `)
  }

  private getDocumentByPath(filePath: string) {
    const row = withStatement(
      this.db.prepare("SELECT id, file_path, title, 0 AS chunks FROM docs WHERE file_path = ?"),
      (stmt) => stmt.get(filePath),
    ) as DocumentRow | undefined
    if (!row) throw new Error(`Indexed NE RAG document not found after upsert: ${filePath}`)
    return toDocument(row)
  }

  private getDocumentById(docId: number) {
    const row = withStatement(
      this.db.prepare("SELECT id, file_path, title, 0 AS chunks FROM docs WHERE id = ?"),
      (stmt) => stmt.get(docId),
    ) as DocumentRow | undefined
    if (!row) throw new Error(`Indexed NE RAG document not found: ${docId}`)
    return toDocument(row)
  }

  private loadSearchRows(docId: number | undefined) {
    const sql = `SELECT c.doc_id, c.file_path, c.chunk_idx, c.text, c.vector, c.dim, d.title AS doc_title
      FROM chunks c
      LEFT JOIN docs d ON d.id = c.doc_id
      ${docId === undefined ? "" : "WHERE c.doc_id = ?"}`
    const stmt = this.db.prepare(sql)
    return withStatement(stmt, (statement) =>
      docId === undefined ? statement.all() : statement.all(docId),
    ) as ChunkRow[]
  }
}

function withStatement<T>(statement: NeRagSqliteStatement, use: (statement: NeRagSqliteStatement) => T) {
  try {
    return use(statement)
  } finally {
    statement.finalize()
  }
}

function scoreRow(row: ChunkRow, queryVector: readonly number[]): NeSearchHit {
  const vector = bufferToVector(toBuffer(row.vector), row.dim)
  return {
    docId: row.doc_id,
    docTitle: row.doc_title ?? titleFromPath(row.file_path),
    filePath: row.file_path,
    chunkIndex: row.chunk_idx,
    text: row.text,
    similarity: cosine(queryVector, vector),
  }
}

function vectorToBuffer(vector: readonly number[]) {
  const buffer = Buffer.alloc(vector.length * Float32Array.BYTES_PER_ELEMENT)
  vector.forEach((value, index) =>
    buffer.writeFloatLE(readVectorValue(vector, index), index * Float32Array.BYTES_PER_ELEMENT),
  )
  return buffer
}

function bufferToVector(buffer: Buffer, dim: number) {
  return Array.from({ length: dim }, (_item, index) => buffer.readFloatLE(index * Float32Array.BYTES_PER_ELEMENT))
}

function toBuffer(value: unknown) {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  throw new Error("SQLite vector column did not return a buffer.")
}

function cosine(a: readonly number[], b: readonly number[]) {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} !== ${b.length}`)
  const sum = a.reduce(
    (acc, value, index) => {
      const av = readVectorValue(a, index)
      const bv = readVectorValue(b, index)
      return {
        dot: acc.dot + av * bv,
        normA: acc.normA + av * av,
        normB: acc.normB + bv * bv,
      }
    },
    { dot: 0, normA: 0, normB: 0 },
  )
  return sum.normA === 0 || sum.normB === 0 ? 0 : sum.dot / (Math.sqrt(sum.normA) * Math.sqrt(sum.normB))
}

function readVectorValue(vector: readonly number[], index: number) {
  const value = vector[index]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid vector value at index ${index}.`)
  }
  return value
}

function toDocument(row: DocumentRow): NeDocument {
  return { id: row.id, filePath: row.file_path, title: row.title, chunks: row.chunks }
}

function titleFromPath(filePath: string) {
  return basename(filePath, extname(filePath))
}
