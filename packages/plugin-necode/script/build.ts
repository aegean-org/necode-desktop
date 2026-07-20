#!/usr/bin/env bun
import { $ } from "bun"
import { fileURLToPath } from "node:url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const result = await Bun.build({
  entrypoints: ["src/index.ts", "src/tool.ts", "src/tui.ts"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  packages: "external",
})
if (!result.success) throw new AggregateError(result.logs, "Failed to build @necode-ai/plugin")
await $`bun tsc --emitDeclarationOnly`
