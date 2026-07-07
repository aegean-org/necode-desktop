import { readdir, readFile, stat } from "node:fs/promises"
import { extname, join } from "node:path"
import { NE_RAG_CHUNK_OVERLAP, NE_RAG_CHUNK_SIZE } from "@/ne/constants"

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".pdf"])

export function isNeRagSupportedFile(filePath: string) {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export async function scanNeRagFiles(inputPath: string) {
  const inputStat = await stat(inputPath)
  if (inputStat.isFile()) {
    if (!isNeRagSupportedFile(inputPath)) throw new Error(`Unsupported NE RAG file type: ${extname(inputPath)}`)
    return [inputPath]
  }
  if (!inputStat.isDirectory()) throw new Error(`NE RAG path is neither a file nor a directory: ${inputPath}`)
  return scanDirectory(inputPath)
}

/** Extract plain text from a supported local NE RAG source file. */
export async function extractNeRagText(filePath: string, signal?: AbortSignal) {
  const ext = extname(filePath).toLowerCase()
  if (ext === ".md" || ext === ".txt") return readFile(filePath, "utf8")
  if (ext === ".pdf") return extractPdfWithMarkit(filePath, signal)
  throw new Error(`Unsupported NE RAG file type: ${ext}`)
}

export function chunkNeRagText(text: string, size = NE_RAG_CHUNK_SIZE, overlap = NE_RAG_CHUNK_OVERLAP) {
  if (size <= 0) throw new Error("NE RAG chunk size must be greater than 0.")
  if (overlap < 0 || overlap >= size) throw new Error("NE RAG chunk overlap must be lower than chunk size.")
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (!cleaned) return []
  return chunkCleanText(cleaned, size, overlap)
}

async function scanDirectory(dir: string): Promise<string[]> {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) return scanDirectory(fullPath)
      if (entry.isFile() && isNeRagSupportedFile(fullPath)) return Promise.resolve([fullPath])
      return Promise.resolve([])
    }),
  )
  return nested.flat()
}

function chunkCleanText(text: string, size: number, overlap: number) {
  const chunks: string[] = []
  for (let start = 0; start < text.length; start += size - overlap) {
    chunks.push(text.slice(start, Math.min(start + size, text.length)))
    if (start + size >= text.length) break
  }
  return chunks
}

async function extractPdfWithMarkit(filePath: string, signal?: AbortSignal) {
  const { convertFileWithMarkit } = await import("./markit")
  const result = await convertFileWithMarkit(filePath, signal)
  if (result.ok) return result.content
  throw new Error(`PDF text extraction failed for ${filePath}: ${result.error ?? "Conversion produced no output"}`)
}
