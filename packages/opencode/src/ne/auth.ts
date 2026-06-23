import { constants, publicEncrypt } from "node:crypto"
import { NE_LOGIN_EXPIRE_SECONDS, NE_LOGIN_URL, NE_PUBLIC_KEY_URL } from "./constants"

type EncryptPassword = (password: string, publicKey: string) => string
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type NeLoginInput = {
  readonly username: string
  readonly password: string
  readonly fetcher?: Fetcher
  readonly encryptPassword?: EncryptPassword
}

export type NeLoginResult = {
  readonly token: string
  readonly accountId?: string
  readonly displayName?: string
}

type JsonRecord = Record<string, unknown>

export async function loginToNe(input: NeLoginInput): Promise<NeLoginResult> {
  const username = requireUsername(input.username)
  const fetcher = input.fetcher ?? fetch
  const publicKey = await fetchNePublicKey(fetcher)
  const password = (input.encryptPassword ?? encryptNePassword)(requirePassword(input.password), publicKey)
  return parseLoginResponse(await postNeLogin(fetcher, username, password))
}

function requireUsername(value: string) {
  const username = value.trim()
  if (!username) throw new Error("NE login username cannot be empty.")
  return username
}

function requirePassword(value: string) {
  if (!value) throw new Error("NE login password cannot be empty.")
  return value
}

async function fetchNePublicKey(fetcher: Fetcher) {
  const data = await readJsonResponse(await fetcher(NE_PUBLIC_KEY_URL), "NE public key")
  const publicKey = isRecord(data.data) ? data.data.public_key : undefined
  if (typeof publicKey !== "string" || publicKey.trim() === "") {
    throw new Error("NE public key response did not include data.public_key.")
  }
  return publicKey
}

function encryptNePassword(password: string, publicKey: string) {
  return publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(password, "utf8")).toString(
    "base64",
  )
}

async function postNeLogin(fetcher: Fetcher, username: string, password: string) {
  return readJsonResponse(
    await fetcher(NE_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json, text/plain, */*" },
      body: new URLSearchParams({
        target: username,
        password,
        expire: String(NE_LOGIN_EXPIRE_SECONDS),
      }),
    }),
    "NE login",
  )
}

async function readJsonResponse(response: Response, label: string): Promise<JsonRecord> {
  if (!response.ok) throw new Error(`${label} request failed: ${response.status} ${response.statusText}`)
  const data = await response.json()
  if (!isRecord(data)) throw new Error(`${label} response was not an object.`)
  return data
}

function parseLoginResponse(response: JsonRecord): NeLoginResult {
  if (response.code !== 0 && response.code !== "0") {
    throw new Error(`NE login failed: ${loginErrorMessage(response)}`)
  }
  const data = response.data
  const token = isRecord(data) ? data.token : undefined
  if (typeof token !== "string" || token.trim() === "") throw new Error("NE login response did not include data.token.")
  return {
    token,
    accountId: isRecord(data) ? stringValue(data.account_id) : undefined,
    displayName: isRecord(data) ? (stringValue(data.email) ?? stringValue(data.mobile)) : undefined,
  }
}

function loginErrorMessage(response: JsonRecord) {
  return stringValue(response.msg) ?? stringValue(response.message) ?? String(response.code ?? "unknown error")
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") return value
  if (typeof value === "number") return String(value)
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
