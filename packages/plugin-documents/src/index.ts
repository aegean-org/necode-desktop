import type { Plugin, PluginManifest } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"
import { DocumentTools } from "./server.ts"

/** Package root used to resolve bundled skills in workspace and desktop layouts. */
export const DocumentsRoot = fileURLToPath(new URL("..", import.meta.url))

/** Metadata displayed by NeCode's plugin management surface. */
export const DocumentsManifest = {
  id: "documents",
  name: "Documents",
  description: "创建、读取和修订 Word 文档",
  skills: ["./skills/"],
} satisfies PluginManifest

/** First-party Documents plugin entrypoint. */
export const DocumentsPlugin: Plugin = async () => ({ tool: DocumentTools })

export { DocumentTools } from "./server.ts"
export { readDocument } from "./read.ts"
export { writeDocument } from "./write.ts"
