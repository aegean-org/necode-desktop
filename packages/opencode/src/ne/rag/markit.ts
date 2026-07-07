import type { Markit } from "markit-ai"

const MUPDF_WARNING_PREFIX = "warning:"
// Keep markit-ai outside Bun.build's static graph; its PDF path requires MuPDF through a TLA-bearing module.
const MARKIT_AI_PACKAGE = ["markit", "ai"].join("-")

/** Result returned by the local document converter before RAG indexing decides how to surface failures. */
export interface MarkitConversionResult {
  readonly content: string
  readonly ok: boolean
  readonly error?: string
}

interface MuPdfWasmModuleOptions {
  readonly printErr?: (message: unknown) => void
}

type GlobalWithMuPdf = typeof globalThis & {
  $libmupdf_wasm_Module?: MuPdfWasmModuleOptions
}

let markit: Markit | undefined

/** Convert a local document to Markdown through markit-ai. */
export async function convertFileWithMarkit(filePath: string, signal?: AbortSignal): Promise<MarkitConversionResult> {
  try {
    const result = await runMarkitConversion((instance) => instance.convertFile(filePath), signal)
    return finalizeConversion(result.markdown)
  } catch (error) {
    if (isAbortError(error)) throw error
    return { content: "", ok: false, error: normalizeError(error) }
  }
}

async function getMarkit() {
  if (markit) return markit
  installMuPdfStderrHandler()
  const module = (await import(MARKIT_AI_PACKAGE)) as typeof import("markit-ai")
  markit = new module.Markit()
  return markit
}

function installMuPdfStderrHandler() {
  const globalWithMuPdf = globalThis as GlobalWithMuPdf
  globalWithMuPdf.$libmupdf_wasm_Module = {
    ...globalWithMuPdf.$libmupdf_wasm_Module,
    printErr: handleMuPdfStderr,
  }
}

function handleMuPdfStderr(message: unknown) {
  const text = String(message).trim()
  if (!text || text.startsWith(MUPDF_WARNING_PREFIX)) return
  process.stderr.write(`MuPDF stderr during markit conversion: ${text}\n`)
}

function finalizeConversion(markdown?: string): MarkitConversionResult {
  if (typeof markdown === "string" && markdown.length > 0) return { content: markdown, ok: true }
  return { content: "", ok: false, error: "Conversion produced no output" }
}

function normalizeError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  return "Conversion failed"
}

async function runMarkitConversion<T>(task: (markit: Markit) => Promise<T>, signal?: AbortSignal) {
  if (signal?.aborted) throw abortError(signal)
  const conversion = getMarkit().then(task)
  if (!signal) return conversion
  return runWithAbort(conversion, signal)
}

function runWithAbort<T>(conversion: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort)
    const onAbort = () => {
      cleanup()
      reject(abortError(signal))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    conversion.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

function abortError(signal: AbortSignal) {
  if (isAbortError(signal.reason)) return signal.reason
  const message = signal.reason instanceof Error ? signal.reason.message : "Aborted"
  return new DOMException(message, "AbortError")
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError"
}
