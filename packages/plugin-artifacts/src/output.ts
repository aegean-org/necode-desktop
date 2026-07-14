import type { ToolAttachment, ToolContext } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** Requested output name and optional explicit target path. */
export type OutputInput = { filename: string; outputPath?: string }

/** Absolute filesystem output and its file URL attachment target. */
export type ArtifactOutput = { path: string; url: string }

/** Resolves a safe session artifact or an explicitly permitted output path. */
export async function resolveArtifactOutput(context: ToolContext, input: OutputInput): Promise<ArtifactOutput> {
  const filename = requireFilename(input.filename)
  if (!input.outputPath) {
    const output = await context.artifact(filename)
    await mkdir(path.dirname(output.path), { recursive: true })
    return output
  }
  const target = path.resolve(context.directory, input.outputPath)
  await requestPath(context, "edit", target)
  if (isExternal(context.worktree, target)) await requestPath(context, "external_directory", target)
  await mkdir(path.dirname(target), { recursive: true })
  return { path: target, url: pathToFileURL(target).href }
}

/** Resolves, permits, and verifies one readable input file. */
export async function requireReadableInput(context: ToolContext, inputPath: string): Promise<ArtifactOutput> {
  const target = path.resolve(context.directory, inputPath)
  await requestPath(context, "read", target)
  if (isExternal(context.worktree, target)) await requestPath(context, "external_directory", target)
  if (!existsSync(target)) throw new Error(`Input file does not exist: ${target}`)
  return { path: target, url: pathToFileURL(target).href }
}

/** Creates a file attachment for a verified artifact output. */
export function artifactAttachment(output: ArtifactOutput, mime: string): ToolAttachment {
  return { type: "file", mime, url: output.url, filename: path.basename(output.path) }
}

function requireFilename(filename: string) {
  const value = filename.trim()
  if (!value || value === "." || value === ".." || path.basename(value) !== value) {
    throw new Error(`Invalid artifact filename: ${filename}`)
  }
  return value
}

function isExternal(worktree: string, target: string) {
  const relative = path.relative(path.resolve(worktree), target)
  return relative.startsWith("..") || path.isAbsolute(relative)
}

function requestPath(context: ToolContext, permission: string, target: string) {
  return context.ask({ permission, patterns: [target], always: [], metadata: {} })
}
