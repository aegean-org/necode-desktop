export * as MCPConfigFile from "./config-file"

import { FSUtil } from "@opencode-ai/core/fs-util"
import { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"
import { Effect, Schema } from "effect"
import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
} from "jsonc-parser"

/** A parsed MCP configuration file with its original JSONC source. */
export type Document = {
  readonly path: string
  readonly text: string
  readonly mcp: Readonly<Record<string, ConfigMCPV1.Info>>
}

/** Reads and validates the MCP entries in a JSONC configuration file. */
export const read = Effect.fn("MCPConfigFile.read")(function* (input: { fs: FSUtil.Interface; path: string }) {
  const text = yield* input.fs.readFileStringSafe(input.path).pipe(
    Effect.mapError(
      (cause) =>
        new ReadError({
          path: input.path,
          message: `Unable to read MCP config file: ${describeCause(cause)}`,
          cause,
        }),
    ),
  )
  return yield* decodeDocument(input.path, text ?? "{}")
})

/** Adds or replaces one MCP entry while preserving unrelated JSONC content. */
export const set = Effect.fn("MCPConfigFile.set")(function* (input: {
  fs: FSUtil.Interface
  path: string
  name: string
  config: ConfigMCPV1.Info
}) {
  const document = yield* read(input)
  const edits = modify(document.text, ["mcp", input.name], input.config, FORMATTING)
  yield* input.fs.writeWithDirs(input.path, applyEdits(document.text, edits)).pipe(
    Effect.mapError(
      (cause) =>
        new WriteError({
          path: input.path,
          message: `Unable to write MCP config file: ${describeCause(cause)}`,
          cause,
        }),
    ),
  )
})

/** Renames one MCP entry with a single JSONC edit and filesystem write. */
export const rename = Effect.fn("MCPConfigFile.rename")(function* (input: {
  fs: FSUtil.Interface
  path: string
  from: string
  to: string
  config: ConfigMCPV1.Info
}) {
  const document = yield* read(input)
  if (!Object.hasOwn(document.mcp, input.from)) {
    return yield* new NotFoundError({
      path: input.path,
      name: input.from,
      message: `MCP entry "${input.from}" does not exist in ${input.path}`,
    })
  }
  if (input.from !== input.to && Object.hasOwn(document.mcp, input.to)) {
    return yield* new ConflictError({
      path: input.path,
      name: input.to,
      message: `MCP entry "${input.to}" already exists in ${input.path}`,
    })
  }
  const removed =
    input.from === input.to
      ? document.text
      : applyEdits(document.text, modify(document.text, ["mcp", input.from], undefined, FORMATTING))
  const next = applyEdits(removed, modify(removed, ["mcp", input.to], input.config, FORMATTING))
  yield* input.fs.writeWithDirs(input.path, next).pipe(
    Effect.mapError(
      (cause) =>
        new WriteError({
          path: input.path,
          message: `Unable to write MCP config file: ${describeCause(cause)}`,
          cause,
        }),
    ),
  )
})

/** Removes one MCP entry and removes the parent object when it becomes empty. */
export const remove = Effect.fn("MCPConfigFile.remove")(function* (input: {
  fs: FSUtil.Interface
  path: string
  name: string
}) {
  const document = yield* read(input)
  if (!Object.hasOwn(document.mcp, input.name)) {
    return yield* new NotFoundError({
      path: input.path,
      name: input.name,
      message: `MCP entry "${input.name}" does not exist in ${input.path}`,
    })
  }
  const text = applyEdits(document.text, modify(document.text, ["mcp", input.name], undefined, FORMATTING))
  const parsed = yield* decodeDocument(input.path, text)
  const next = Object.keys(parsed.mcp).length ? text : applyEdits(text, modify(text, ["mcp"], undefined, FORMATTING))
  yield* input.fs.writeWithDirs(input.path, next).pipe(
    Effect.mapError(
      (cause) =>
        new WriteError({
          path: input.path,
          message: `Unable to write MCP config file: ${describeCause(cause)}`,
          cause,
        }),
    ),
  )
})

/** A filesystem failure while reading an MCP configuration file. */
export class ReadError extends Schema.TaggedErrorClass<ReadError>()("MCPConfigFile.ReadError", {
  path: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

/** Invalid JSONC structure or an MCP entry that fails schema validation. */
export class ParseError extends Schema.TaggedErrorClass<ParseError>()("MCPConfigFile.ParseError", {
  path: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

/** A filesystem failure while writing an MCP configuration file. */
export class WriteError extends Schema.TaggedErrorClass<WriteError>()("MCPConfigFile.WriteError", {
  path: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

/** An attempted removal of an MCP entry that is not present. */
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("MCPConfigFile.NotFoundError", {
  path: Schema.String,
  name: Schema.String,
  message: Schema.String,
}) {}

/** An attempted rename whose destination MCP name is already present. */
export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()("MCPConfigFile.ConflictError", {
  path: Schema.String,
  name: Schema.String,
  message: Schema.String,
}) {}

const FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2 } }

function* decodeDocument(path: string, text: string) {
  const errors: Array<{ error: number; offset: number; length: number }> = []
  const data = parse(text, errors, { allowTrailingComma: true })
  if (errors.length) {
    const message = errors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join(", ")
    return yield* new ParseError({ path, message: `Invalid JSONC: ${message}`, cause: errors })
  }
  if (!isRecord(data)) return yield* invalidStructure(path, "Configuration root must be an object", data)
  if (!Object.hasOwn(data, "mcp")) return { path, text, mcp: Object.create(null) as Record<string, ConfigMCPV1.Info> }
  if (!isRecord(data.mcp)) return yield* invalidStructure(path, 'Configuration field "mcp" must be an object', data.mcp)

  const tree = parseTree(text)
  const node = tree && findNodeAtLocation(tree, ["mcp"])
  if (!node || node.type !== "object") return yield* invalidStructure(path, "Unable to locate the MCP object", node)
  const mcp = Object.create(null) as Record<string, ConfigMCPV1.Info>
  for (const property of node.children ?? []) {
    const name = property.children?.[0]?.value
    const value = property.children?.[1]
    if (typeof name !== "string" || !value) return yield* invalidStructure(path, "Invalid MCP property", property)
    mcp[name] = yield* Schema.decodeUnknownEffect(ConfigMCPV1.Info)(getNodeValue(value)).pipe(
      Effect.mapError(
        (cause) => new ParseError({ path, message: `Invalid MCP config "${name}": ${describeCause(cause)}`, cause }),
      ),
    )
  }
  return { path, text, mcp } satisfies Document
}

function invalidStructure(path: string, message: string, cause: unknown) {
  return new ParseError({ path, message, cause })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function describeCause(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}
