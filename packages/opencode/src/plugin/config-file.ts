export * as PluginConfigFile from "./config-file"

import { FSUtil } from "@opencode-ai/core/fs-util"
import type { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { ConfigPluginV1 } from "@opencode-ai/core/v1/config/plugin"
import { Effect, Schema } from "effect"
import { applyEdits, findNodeAtLocation, getNodeValue, modify, parse, parseTree, printParseErrorCode } from "jsonc-parser"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { ConfigPlugin } from "@/config/plugin"

/** Parsed plugin configuration with its original JSONC source. */
export type Document = {
  readonly path: string
  readonly text: string
  readonly plugin: readonly ConfigPluginV1.Spec[]
  readonly plugin_enabled: Readonly<Record<string, boolean>>
}

type WriteInput = { fs: FSUtil.Interface; flock: EffectFlock.Interface; path: string }
const FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2 } }
const PluginList = Schema.Array(ConfigPluginV1.Spec)

/** Reads and validates plugin sources and enablement from a JSONC configuration file. */
export const read = Effect.fn("PluginConfigFile.read")(function* (input: { fs: FSUtil.Interface; path: string }) {
  const text = yield* input.fs.readFileStringSafe(input.path).pipe(
    Effect.mapError((cause) => new ReadError({ path: input.path, message: describe("Unable to read plugin config", cause), cause })),
  )
  return yield* decodeDocument(input.path, text ?? "{}")
})

/** Appends one plugin spec while preserving unrelated JSONC content. */
export const install = Effect.fn("PluginConfigFile.install")(function* (input: WriteInput & { spec: ConfigPluginV1.Spec }) {
  yield* update(input, (document) => {
    const next = [...document.plugin, input.spec]
    return applyEdits(document.text, modify(document.text, ["plugin"], next, FORMATTING))
  })
})

/** Persists one stable plugin enablement key as an own JSON property. */
export const setEnabled = Effect.fn("PluginConfigFile.setEnabled")(function* (
  input: WriteInput & { key: string; enabled: boolean },
) {
  yield* update(input, (document) =>
    applyEdits(document.text, modify(document.text, ["plugin_enabled", input.key], input.enabled, FORMATTING)),
  )
})

/** Removes one configured plugin and its enablement override from the same source. */
export const remove = Effect.fn("PluginConfigFile.remove")(function* (input: WriteInput & { key: string }) {
  yield* updateEffect(input, (document) =>
    Effect.gen(function* () {
      const keys = yield* Effect.forEach(document.plugin, (spec) => configuredKey(spec, document.path))
      const index = keys.findIndex((key) => key === input.key)
      if (index === -1) {
        return yield* new NotFoundError({ path: input.path, key: input.key, message: `Plugin ${input.key} is not configured` })
      }
      const removed = applyEdits(document.text, modify(document.text, ["plugin", index], undefined, FORMATTING))
      const withoutList = document.plugin.length === 1 ? applyEdits(removed, modify(removed, ["plugin"], undefined, FORMATTING)) : removed
      if (!Object.hasOwn(document.plugin_enabled, input.key)) return withoutList
      const withoutEnabled = applyEdits(
        withoutList,
        modify(withoutList, ["plugin_enabled", input.key], undefined, FORMATTING),
      )
      if (Object.keys(document.plugin_enabled).length > 1) return withoutEnabled
      return applyEdits(withoutEnabled, modify(withoutEnabled, ["plugin_enabled"], undefined, FORMATTING))
    }),
  )
})

/** Removes legacy plugin enablement from a TUI JSONC source after migration succeeds. */
export const clearLegacyEnabled = Effect.fn("PluginConfigFile.clearLegacyEnabled")(function* (input: WriteInput) {
  yield* update(input, (document) => {
    const top = applyEdits(document.text, modify(document.text, ["plugin_enabled"], undefined, FORMATTING))
    return applyEdits(top, modify(top, ["tui", "plugin_enabled"], undefined, FORMATTING))
  })
})

/** Filesystem failure while reading plugin configuration. */
export class ReadError extends Schema.TaggedErrorClass<ReadError>()("PluginConfigFile.ReadError", {
  path: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

/** Invalid JSONC structure or plugin configuration schema. */
export class ParseError extends Schema.TaggedErrorClass<ParseError>()("PluginConfigFile.ParseError", {
  path: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

/** Filesystem or lock failure while writing plugin configuration. */
export class WriteError extends Schema.TaggedErrorClass<WriteError>()("PluginConfigFile.WriteError", {
  path: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

/** Requested plugin key is not present in the selected configuration source. */
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("PluginConfigFile.NotFoundError", {
  path: Schema.String,
  key: Schema.String,
  message: Schema.String,
}) {}

function update(input: WriteInput, change: (document: Document) => string) {
  return updateEffect(input, (document) => Effect.sync(() => change(document)))
}

function updateEffect<E>(input: WriteInput, change: (document: Document) => Effect.Effect<string, E>) {
  return input.flock
    .withLock(
      Effect.gen(function* () {
        const document = yield* read(input)
        const next = yield* change(document)
        if (next === document.text) return
        yield* atomicWrite(input.fs, input.path, next)
      }),
      `plugin-config:${path.resolve(input.path)}`,
    )
    .pipe(Effect.mapError((error) => mapWriteError(input.path, error)))
}

function atomicWrite(fs: FSUtil.Interface, target: string, text: string) {
  return Effect.gen(function* () {
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`)
    yield* fs.writeWithDirs(temporary, text)
    yield* fs.rename(temporary, target)
  })
}

function* decodeDocument(source: string, text: string) {
  const errors: Array<{ error: number; offset: number; length: number }> = []
  parse(text, errors, { allowTrailingComma: true })
  if (errors.length) {
    const message = errors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join(", ")
    return yield* new ParseError({ path: source, message: `Invalid JSONC: ${message}`, cause: errors })
  }
  const tree = parseTree(text)
  if (!tree || tree.type !== "object") return yield* invalid(source, "Configuration root must be an object", tree)
  const plugin = yield* decodePlugins(source, findNodeAtLocation(tree, ["plugin"]))
  const enabled = yield* decodeEnabled(source, findNodeAtLocation(tree, ["plugin_enabled"]))
  return { path: source, text, plugin, plugin_enabled: enabled } satisfies Document
}

function decodePlugins(source: string, node: ReturnType<typeof findNodeAtLocation>) {
  if (!node) return Effect.succeed([] as ConfigPluginV1.Spec[])
  return Schema.decodeUnknownEffect(PluginList)(getNodeValue(node)).pipe(
    Effect.map((items) => [...items]),
    Effect.mapError((cause) => new ParseError({ path: source, message: describe("Invalid plugin list", cause), cause })),
  )
}

function decodeEnabled(source: string, node: ReturnType<typeof findNodeAtLocation>) {
  if (!node) return Effect.succeed(Object.create(null) as Record<string, boolean>)
  if (node.type !== "object") return Effect.fail(invalid(source, 'Configuration field "plugin_enabled" must be an object', node))
  const enabled = Object.create(null) as Record<string, boolean>
  for (const property of node.children ?? []) {
    const key = property.children?.[0]?.value
    const value = property.children?.[1]?.value
    if (typeof key !== "string" || typeof value !== "boolean") {
      return Effect.fail(invalid(source, "Invalid plugin_enabled property", property))
    }
    enabled[key] = value
  }
  return Effect.succeed(enabled)
}

function configuredKey(spec: ConfigPluginV1.Spec, source: string) {
  return Effect.promise(async () => ConfigPlugin.key(await ConfigPlugin.resolvePluginSpec(spec, source)))
}

function invalid(source: string, message: string, cause: unknown) {
  return new ParseError({ path: source, message, cause })
}

function mapWriteError(source: string, cause: unknown) {
  if (cause instanceof ParseError || cause instanceof ReadError || cause instanceof NotFoundError) return cause
  return new WriteError({ path: source, message: describe("Unable to write plugin config", cause), cause })
}

function describe(message: string, cause: unknown) {
  return `${message}: ${cause instanceof Error ? cause.message : String(cause)}`
}
