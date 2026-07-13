import type { JSONSchema7, JSONSchema7Definition } from "@ai-sdk/provider"
import type { ToolContext, ToolDefinition } from "@opencode-ai/plugin"
import { Effect, Schema } from "effect"
import z from "zod"
import type { Agent } from "@/agent/agent"
import { EffectBridge } from "@/effect/bridge"
import type { InstanceContext } from "@/project/instance-context"
import { Tool } from "./tool"
import { ToolArtifact } from "./artifact"
import type { Truncate } from "./truncate"

type Input = {
  id: string
  definition: ToolDefinition
  context: Pick<InstanceContext, "directory" | "worktree">
  agent: Agent.Interface
  truncate: Truncate.Interface
}

/** Converts a public plugin tool definition into the runtime Tool registry contract. */
export function createPluginTool(input: Input): Tool.Def {
  const args = input.definition.args ?? {}
  const entries = Object.entries(args)
  const allZod = entries.every((entry) => isZodType(entry[1]))
  const zodParams = allZod ? z.object(args) : undefined
  const jsonSchema = zodParams ? zodJsonSchema(zodParams) : legacyJsonSchema(entries)
  const parameters = zodParams
    ? Schema.declare<unknown>((value): value is unknown => zodParams.safeParse(value).success)
    : Schema.Unknown
  return {
    id: input.id,
    parameters,
    jsonSchema,
    description: input.definition.description,
    execute: (args, toolCtx) => executePluginTool(input, args, toolCtx),
  }
}

/** Identifies plugin tool exports without importing or executing them. */
export function isPluginTool(value: unknown): value is ToolDefinition {
  return typeof value === "object" && value !== null && "args" in value && "description" in value && "execute" in value
}

function executePluginTool(input: Input, args: unknown, toolCtx: Tool.Context) {
  return Effect.gen(function* () {
    const bridge = yield* EffectBridge.make()
    const pluginCtx: ToolContext = {
      ...toolCtx,
      ask: (request) => bridge.promise(toolCtx.ask(request)),
      artifact: (filename) => ToolArtifact.allocate(toolCtx.sessionID, filename),
      directory: input.context.directory,
      worktree: input.context.worktree,
    }
    const result = yield* Effect.promise(() => input.definition.execute(args as Record<string, unknown>, pluginCtx))
    const output = typeof result === "string" ? result : result.output
    const metadata = typeof result === "string" ? {} : (result.metadata ?? {})
    const info = yield* input.agent.get(toolCtx.agent)
    const truncated = yield* input.truncate.output(output, {}, info)
    return {
      title: typeof result === "string" ? "" : (result.title ?? ""),
      output: truncated.truncated ? truncated.content : output,
      attachments: typeof result === "string" ? undefined : result.attachments,
      metadata: {
        ...metadata,
        truncated: truncated.truncated,
        ...(truncated.truncated && { outputPath: truncated.outputPath }),
      },
    }
  }).pipe(
    Effect.withSpan("Tool.execute", {
      attributes: {
        "tool.name": input.id,
        "session.id": toolCtx.sessionID,
        "message.id": toolCtx.messageID,
        ...(toolCtx.callID ? { "tool.call_id": toolCtx.callID } : {}),
      },
    }),
  )
}

function isZodType(value: unknown): value is z.ZodType {
  return typeof value === "object" && value !== null && "_zod" in value
}

function isJsonSchemaDefinition(value: unknown): value is JSONSchema7Definition {
  return typeof value === "boolean" || (typeof value === "object" && value !== null && !Array.isArray(value))
}

function legacyJsonSchema(entries: [string, unknown][]): JSONSchema7 {
  const properties = Object.fromEntries(
    entries.filter((entry): entry is [string, JSONSchema7Definition] => isJsonSchemaDefinition(entry[1])),
  )
  return { type: "object", properties, required: Object.keys(properties) }
}

function zodJsonSchema(schema: z.ZodType): JSONSchema7 {
  const result = normalizeZodJsonSchema(z.toJSONSchema(schema, { io: "input", metadata: zodMetadataRegistry(schema) }))
  if (!isJsonSchemaObject(result)) throw new Error("plugin tool Zod schema produced a non-object JSON Schema")
  const { $defs, ...rest } = result
  return (
    $defs && isJsonSchemaObject($defs) ? { ...rest, definitions: $defs as JSONSchema7["definitions"] } : rest
  ) as JSONSchema7
}

function zodMetadataRegistry(schema: z.ZodType) {
  const registry = z.registry<Record<string, unknown>>()
  const seen = new WeakSet<object>()
  const collect = (value: unknown) => {
    if (typeof value !== "object" || value === null || seen.has(value)) return
    seen.add(value)
    if (!isZodType(value)) return Object.values(value).forEach(collect)
    const metadata = typeof value.meta === "function" ? value.meta() : undefined
    const description = typeof value.description === "string" ? value.description : undefined
    const merged = { ...(metadata && typeof metadata === "object" ? metadata : {}), ...(description ? { description } : {}) }
    if (Object.keys(merged).length) registry.add(value, merged)
    collect(value._zod.def)
  }
  collect(schema)
  return registry
}

function normalizeZodJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeZodJsonSchema)
  if (!isJsonSchemaObject(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => !(["exclusiveMaximum", "exclusiveMinimum"].includes(key) && typeof item === "boolean"))
      .map(([key, item]) => [key, normalizeZodJsonSchema(item)]),
  )
}

function isJsonSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
