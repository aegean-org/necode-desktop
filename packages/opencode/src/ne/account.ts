import { Schema } from "effect"
import { NE_TOKEN_ACCOUNT_URL } from "./constants"
import { buildNeGatewayAuthorization } from "./gateway-auth"

type JsonRecord = Record<string, unknown>
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
const FiniteNumber = Schema.Number.check(Schema.isFinite())

export const TokenAccount = Schema.Struct({
  remaining: FiniteNumber,
  totalExpense: FiniteNumber,
  totalWriteOff: FiniteNumber,
  totalConsumed: FiniteNumber,
  updateTime: Schema.optional(Schema.String),
}).annotate({ identifier: "NeTokenAccount" })

export async function fetchNeTokenAccount(token: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(NE_TOKEN_ACCOUNT_URL, {
    method: "GET",
    headers: { accept: "application/json", Authorization: buildNeGatewayAuthorization(token) },
  })
  if (!response.ok) throw new Error(`NE token account request failed: ${response.status} ${response.statusText}`)
  return parseNeTokenAccount(await response.json())
}

export function parseNeTokenAccount(value: unknown): Schema.Schema.Type<typeof TokenAccount> {
  if (!isRecord(value)) throw new Error("NE token account response was not an object.")
  if (value.code !== undefined && value.code !== 0 && value.code !== "0") {
    throw new Error(`NE token account request failed: ${stringValue(value.message) ?? stringValue(value.msg) ?? value.code}`)
  }
  const account = isRecord(value.data) ? value.data : value
  const totalExpense = numberField(account, "total_expense")
  const totalWriteOff = numberField(account, "total_write_off")
  return {
    remaining: numberField(account, "remaining"),
    totalExpense,
    totalWriteOff,
    totalConsumed: totalExpense + totalWriteOff,
    updateTime: optionalStringField(account, "update_time"),
  }
}

function numberField(record: JsonRecord, key: string) {
  const value = record[key]
  if (typeof value === "number" && Number.isFinite(value)) return value
  throw new Error(`NE token account field "${key}" must be a finite number.`)
}

function optionalStringField(record: JsonRecord, key: string) {
  const value = record[key]
  if (value === undefined || value === null) return
  if (typeof value === "string") return value
  throw new Error(`NE token account field "${key}" must be a string.`)
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") return value
  if (typeof value === "number") return String(value)
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
