import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PLUGINS = [
  "@necode-ai/plugin-documents",
  "@necode-ai/plugin-pdf",
  "@necode-ai/plugin-presentations",
  "@necode-ai/plugin-spreadsheets",
] as const
const RUNTIME_PACKAGES = ["@necode-ai/plugin-artifacts", ...PLUGINS] as const

/** Fails desktop prebuild when a packaged productivity entry, skill, or licensed asset is missing. */
export function verifyProductivityRuntime() {
  RUNTIME_PACKAGES.forEach((spec) => {
    const root = fileURLToPath(new URL("..", import.meta.resolve(spec)))
    requirePath(path.join(root, "dist", "index.js"), `${spec} Node entry`)
  })
  PLUGINS.forEach((spec) => {
    const root = fileURLToPath(new URL("..", import.meta.resolve(spec)))
    requirePath(path.join(root, "package.json"), spec)
    requirePath(path.join(root, "skills"), spec)
  })
  const pdfRoot = fileURLToPath(new URL("..", import.meta.resolve("@necode-ai/plugin-pdf")))
  requirePath(path.join(pdfRoot, "assets", "NotoSansCJKsc-Regular.otf"), "PDF font")
  requirePath(path.join(pdfRoot, "assets", "OFL.txt"), "PDF font license")
}

function requirePath(target: string, label: string) {
  if (!existsSync(target)) throw new Error(`Missing productivity runtime asset for ${label}: ${target}`)
}
