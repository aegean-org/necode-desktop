import type { Model } from "@opencode-ai/sdk/v2"
import {
  NE_CHAT_MODEL_DEFAULT_CONTEXT,
  NE_CHAT_MODEL_DEFAULT_OUTPUT,
  NE_DEFAULT_EMBEDDING_MODEL,
  NE_GATEWAY_BASE_URL,
  NE_MODELS_URL,
  NE_PROVIDER_ID,
} from "./constants"
import { buildNeGatewayAuthorization } from "./gateway-auth"

type JsonRecord = Record<string, unknown>
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const ZERO_COST = { input: 0, output: 0, cache: { read: 0, write: 0 } }
const MODEL_ID_KEYS = ["id", "model", "model_id", "modelId"]
const MODEL_NAME_KEYS = ["name", "display_name", "displayName", "label"]
const MODEL_TYPE_KEYS = ["type", "model_type", "modelType", "api", "mode", "category", "task"]
const MODEL_SEARCH_KEYS = [...MODEL_ID_KEYS, ...MODEL_NAME_KEYS, ...MODEL_TYPE_KEYS]
const EMBEDDING_PATTERN = /(^|[-_/\s])embeddings?($|[-_/\s])/u
const ASR_PATTERN = /(^|[-_/\s])asr($|[-_/\s])/u
const HTTP_UNAUTHORIZED = 401

/**
 * Signals that the stored NE token is no longer accepted by the gateway.
 */
export class NeAuthExpiredError extends Error {
  constructor(statusText: string) {
    super(`NE model dictionary authorization expired: ${statusText || HTTP_UNAUTHORIZED}`)
    this.name = "NeAuthExpiredError"
  }
}

/**
 * Fetches the NE model dictionary and returns chat-capable models only.
 */
export async function fetchNeModels(token: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(NE_MODELS_URL, {
    method: "GET",
    headers: { accept: "application/json", Authorization: buildNeGatewayAuthorization(token) },
  })
  if (response.status === HTTP_UNAUTHORIZED) throw new NeAuthExpiredError(response.statusText)
  if (!response.ok) throw new Error(`NE model dictionary request failed: ${response.status} ${response.statusText}`)
  return createNeModels(await response.json())
}

/**
 * Converts the NE model dictionary into OpenCode models and excludes non-chat entries.
 */
export function createNeModels(value: unknown): Record<string, Model> {
  assertSuccessfulDictionaryResponse(value)
  const entries = extractModelEntries(value).filter((entry) => !isNonChatModelEntry(entry))
  if (entries.length === 0) throw new Error("NE model dictionary did not include any chat models.")
  return Object.fromEntries(entries.map((entry, index) => toModelEntry(entry, index)))
}

function assertSuccessfulDictionaryResponse(value: unknown) {
  if (!isRecord(value)) return
  if (value.code === undefined || value.code === 0 || value.code === "0") return
  throw new Error(`NE model dictionary failed: ${stringValue(value.msg) ?? stringValue(value.message) ?? value.code}`)
}

function extractModelEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) throw new Error("NE model dictionary response was not an object or array.")
  if (Array.isArray(value.data)) return value.data
  if (isRecord(value.data)) {
    const nested = getArrayField(value.data, ["models", "list", "items"])
    if (nested) return nested
  }
  const topLevel = getArrayField(value, ["models", "list", "items"])
  if (topLevel) return topLevel
  throw new Error("NE model dictionary response did not include a model array.")
}

function toModelEntry(entry: unknown, index: number): [string, Model] {
  const record = typeof entry === "string" ? {} : requireModelRecord(entry, index)
  const id = typeof entry === "string" ? entry : requireStringField(record, MODEL_ID_KEYS, index)
  const name = typeof entry === "string" ? entry : (getStringField(record, MODEL_NAME_KEYS) ?? id)
  return [id, createModel(id, name, record, index)]
}

function createModel(id: string, name: string, record: JsonRecord, index: number): Model {
  const input = inputCapabilities(record)
  return {
    id,
    providerID: NE_PROVIDER_ID,
    name,
    api: { id, url: NE_GATEWAY_BASE_URL, npm: "@ai-sdk/openai-compatible" },
    status: getStatus(record.status),
    headers: {},
    options: {},
    cost: ZERO_COST,
    limit: {
      context: positiveNumberField(record, ["contextWindow", "context_window", "contextLength"], index),
      output: positiveNumberField(record, ["maxTokens", "max_tokens", "maxOutputTokens"], index, true),
    },
    capabilities: {
      temperature: true,
      reasoning: booleanField(record, ["reasoning", "supportReasoning", "supports_reasoning"]) ?? true,
      attachment: input.image || input.pdf,
      toolcall: booleanField(record, ["tool_call", "toolcall", "tools"]) ?? true,
      input,
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: stringValue(record.release_date) ?? "",
    variants: {},
  }
}

function inputCapabilities(record: JsonRecord) {
  const input = record.input ?? record.inputs
  const values = Array.isArray(input)
    ? input.filter((value): value is string => typeof value === "string").map((value) => value.trim().toLowerCase())
    : undefined
  const image = values
    ? values.includes("image")
    : (booleanField(record, ["supportsImage", "supports_image", "vision"]) ?? true)
  return {
    text: true,
    audio: false,
    image,
    video: false,
    pdf: values?.includes("pdf") ?? false,
  }
}

function isNonChatModelEntry(entry: unknown) {
  const id = typeof entry === "string" ? entry : isRecord(entry) ? getStringField(entry, MODEL_ID_KEYS) : undefined
  if (id?.trim().toLowerCase() === NE_DEFAULT_EMBEDDING_MODEL) return true
  if (id && ASR_PATTERN.test(id.trim().toLowerCase())) return true
  if (!isRecord(entry)) return false
  const type = getStringField(entry, MODEL_TYPE_KEYS)
  if (type && EMBEDDING_PATTERN.test(type.trim().toLowerCase())) return true
  return getStringFields(entry, MODEL_SEARCH_KEYS).some((value) => ASR_PATTERN.test(value.trim().toLowerCase()))
}

function requireModelRecord(entry: unknown, index: number) {
  if (isRecord(entry)) return entry
  throw new Error(`NE model dictionary entry ${index + 1} was not an object or string.`)
}

function requireStringField(record: JsonRecord, keys: string[], index: number) {
  const value = getStringField(record, keys)
  if (value) return value
  throw new Error(`NE model dictionary entry ${index + 1} did not include a model id.`)
}

function getStringField(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim() !== "") return value
  }
}

function getStringFields(record: JsonRecord, keys: string[]) {
  return keys.flatMap((key) => {
    const value = record[key]
    return typeof value === "string" && value.trim() !== "" ? [value] : []
  })
}

function booleanField(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
  }
}

function positiveNumberField(record: JsonRecord, keys: string[], index: number, output = false) {
  for (const key of keys) {
    const value = record[key]
    if (value === undefined) continue
    if (typeof value === "number" && value > 0) return value
    throw new Error(`NE model dictionary entry ${index + 1} field "${key}" must be a positive number.`)
  }
  return output ? NE_CHAT_MODEL_DEFAULT_OUTPUT : NE_CHAT_MODEL_DEFAULT_CONTEXT
}

function getArrayField(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
}

function getStatus(value: unknown): Model["status"] {
  if (value === "alpha" || value === "beta" || value === "deprecated") return value
  return "active"
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") return value
  if (typeof value === "number") return String(value)
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
