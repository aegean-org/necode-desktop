type PickedFilePath = { readonly path: string; readonly name?: string; readonly size?: number }
type PickedPath = string | readonly string[] | readonly PickedFilePath[] | null | undefined
type RagNumber = number | "-Infinity" | "Infinity" | "NaN"
type RagStatusLike = { readonly documents: readonly { readonly chunks: RagNumber }[]; readonly chunks: RagNumber }

/** Normalizes native file/folder picker outputs into local paths accepted by the RAG import API. */
export function pickedRagPaths(input: PickedPath) {
  if (!input) return []
  if (typeof input === "string") return [input]
  return input.map((item) => (typeof item === "string" ? item : item.path)).filter((path) => path.length > 0)
}

export function formatRagFileSize(size: number) {
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${formatSize(kb)} KB`
  return `${formatSize(kb / 1024)} MB`
}

export function ragStatusSummary(status: RagStatusLike) {
  return { documents: status.documents.length, chunks: readFiniteRagNumber(status.chunks) }
}

function formatSize(size: number) {
  return Number.isInteger(size) ? String(size) : size.toFixed(1)
}

function readFiniteRagNumber(value: RagNumber) {
  return typeof value === "number" ? value : 0
}
