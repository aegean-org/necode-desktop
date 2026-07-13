import type { Plugin, PluginManifest } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"
import { PdfTools } from "./server.js"

/** Package root used to resolve bundled skills and font assets. */
export const PdfRoot = fileURLToPath(new URL("..", import.meta.url))

/** Metadata displayed by NeCode's plugin management surface. */
export const PdfManifest = {
  id: "pdf",
  name: "PDF",
  description: "读取、生成、合并和拆分 PDF",
  skills: ["./skills/"],
} satisfies PluginManifest

/** First-party PDF plugin entrypoint. */
export const PdfPlugin: Plugin = async () => ({ tool: PdfTools })

export { createPdf } from "./layout.js"
export { mergePdfFiles, validatePdf, writePdfRange, type PageRange } from "./operations.js"
export { readPdfText } from "./read.js"
export { PdfTools } from "./server.js"
