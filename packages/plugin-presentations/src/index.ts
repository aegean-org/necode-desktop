import type { Plugin, PluginManifest } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"
import { PresentationTools } from "./server.js"

/** Package root used to resolve bundled presentation skills. */
export const PresentationsRoot = fileURLToPath(new URL("..", import.meta.url))

/** Metadata displayed by NeCode's plugin management surface. */
export const PresentationsManifest = {
  id: "presentations",
  name: "Presentations",
  description: "创建、读取和修订 PowerPoint 演示文稿",
  skills: ["./skills/"],
} satisfies PluginManifest

/** First-party Presentations plugin entrypoint. */
export const PresentationsPlugin: Plugin = async () => ({ tool: PresentationTools })

export { readPresentation } from "./read.js"
export { SlideInputSchema, validateSlides, type SlideInput, type SlideLayout } from "./schema.js"
export { PresentationTools } from "./server.js"
export { validatePresentation } from "./validate.js"
export { writePresentation } from "./write.js"
