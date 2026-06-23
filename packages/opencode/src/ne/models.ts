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
const EMBEDDING_PATTERN = /(^|[-_/\s])embeddings?($|[-_/\s])/u

export async function fetchNeModels(token: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(NE_MODELS_URL, {
    method: "GET",
    headers: { accept: "application/json", Authorization: buildNeGatewayAuthorization(token) },
  })
  if (!response.ok) throw new Error(`NE model dictionary request failed: ${response.status} ${response.statusText}`)
  return createNeModels(await response.json())
}

export function createNeModels(value: unknown): Record<string, Model> {
  assertSuccessfulDictionaryResponse(value)
  const entries = extractModelEntries(value).filter((entry) => !isEmbeddingModelEntry(entry))
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
      attachment: false,
      toolcall: booleanField(record, ["tool_call", "toolcall", "tools"]) ?? true,
      input: inputCapabilities(record),
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: stringValue(record.release_date) ?? "",
    variants: {},
  }
}

function inputCapabilities(record: JsonRecord) {
  const input = record.input ?? record.inputs
  const values = Array.isArray(input) ? input : booleanField(record, ["supportsImage", "supports_image", "vision"]) ? ["image"] : []
  return {
    text: true,
    audio: false,
    image: values.includes("image"),
    video: false,
    pdf: values.includes("pdf"),
  }
}

function isEmbeddingModelEntry(entry: unknown) {
  const id = typeof entry === "string" ? entry : isRecord(entry) ? getStringField(entry, MODEL_ID_KEYS) : undefined
  if (id?.trim().toLowerCase() === NE_DEFAULT_EMBEDDING_MODEL) return true
  if (!isRecord(entry)) return false
  const type = getStringField(entry, MODEL_TYPE_KEYS)
  return type ? EMBEDDING_PATTERN.test(type.trim().toLowerCase()) : false
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
