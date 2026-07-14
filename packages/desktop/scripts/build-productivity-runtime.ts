#!/usr/bin/env bun
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const packages = [
  "plugin-artifacts",
  "plugin-documents",
  "plugin-pdf",
  "plugin-presentations",
  "plugin-spreadsheets",
] as const
const external = [
  "@pdf-lib/fontkit",
  "@zip.js/zip.js",
  "docx",
  "effect",
  "exceljs",
  "markit-ai",
  "pdf-lib",
  "pptxgenjs",
  "sharp",
] as const

await Promise.all(
  packages.map(async (name) => {
    const root = fileURLToPath(new URL(`../../${name}/`, import.meta.url))
    await rm(path.join(root, "dist"), { recursive: true, force: true })
    const result = await Bun.build({
      entrypoints: [
        path.join(root, "src", "index.ts"),
        ...(existsSync(path.join(root, "src", "server.ts")) ? [path.join(root, "src", "server.ts")] : []),
      ],
      outdir: path.join(root, "dist"),
      target: "node",
      format: "esm",
      external,
    })
    if (!result.success) throw new AggregateError(result.logs, `Failed to build ${name}`)
  }),
)
