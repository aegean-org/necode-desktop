import { NE_DEFAULT_EMBEDDING_MODEL, NE_GATEWAY_BASE_URL } from "@/ne/constants"
import { buildNeGatewayAuthorization } from "@/ne/gateway-auth"

export interface EmbedNeTextsOptions {
  readonly apiKey: string
  readonly texts: readonly string[]
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  readonly signal?: AbortSignal
}

interface NeEmbeddingResponse {
  readonly data?: ReadonlyArray<{ readonly embedding?: unknown }>
}

export async function embedNeTexts(options: EmbedNeTextsOptions) {
  if (options.texts.length === 0) return []
  const response = await (options.fetchImpl ?? fetch)(`${NE_GATEWAY_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: buildNeGatewayAuthorization(options.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: NE_DEFAULT_EMBEDDING_MODEL, input: options.texts }),
    signal: options.signal,
  })
  const data = await readEmbeddingJson(response)
  return parseEmbeddingResponse(data, options.texts.length)
}

async function readEmbeddingJson(response: Response) {
  if (response.ok) return (await response.json()) as NeEmbeddingResponse
  throw new Error(`NE embedding request failed: ${response.status} ${response.statusText}`)
}

function parseEmbeddingResponse(response: NeEmbeddingResponse, expectedCount: number) {
  const vectors = response.data?.map((item) => item.embedding)
  if (!vectors || vectors.length !== expectedCount) {
    throw new Error(`NE embedding response returned ${vectors?.length ?? 0} vectors for ${expectedCount} inputs.`)
  }
  return vectors.map(parseVector)
}

function parseVector(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("NE embedding response contained an empty or invalid vector.")
  }
  return value.map((item) => {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error("NE embedding response contained a non-numeric vector value.")
    }
    return item
  })
}
