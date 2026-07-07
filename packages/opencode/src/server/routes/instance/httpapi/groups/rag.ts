import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { described } from "./metadata"

const RagDocument = Schema.Struct({
  id: Schema.Number,
  filePath: Schema.String,
  title: Schema.String,
  chunks: Schema.Number,
}).annotate({ identifier: "RagDocument" })

const RagIndexFailure = Schema.Struct({
  filePath: Schema.String,
  error: Schema.String,
}).annotate({ identifier: "RagIndexFailure" })

const RagIndexResult = Schema.Struct({
  files: Schema.Number,
  indexedFiles: Schema.Number,
  failedFiles: Schema.Number,
  chunks: Schema.Number,
  failures: Schema.Array(RagIndexFailure),
}).annotate({ identifier: "RagIndexResult" })

export const RagStatus = Schema.Struct({
  enabled: Schema.Boolean,
  storePath: Schema.String,
  documents: Schema.Array(RagDocument),
  chunks: Schema.Number,
}).annotate({ identifier: "RagStatus" })

export const RagImportPayload = Schema.Struct({
  path: Schema.String,
})

export const RagImportResponse = Schema.Struct({
  importResult: RagIndexResult,
  status: RagStatus,
}).annotate({ identifier: "RagImportResponse" })

export class RagCredentialRequiredError extends Schema.TaggedErrorClass<RagCredentialRequiredError>()(
  "RagCredentialRequiredError",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

export class RagImportFailedApiError extends Schema.TaggedErrorClass<RagImportFailedApiError>()(
  "RagImportFailedError",
  {
    message: Schema.String,
    failures: Schema.Array(RagIndexFailure),
  },
  { httpApiStatus: 400 },
) {}

export class RagRequestError extends Schema.TaggedErrorClass<RagRequestError>()(
  "RagRequestError",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

export const RagPaths = {
  status: "/rag/status",
  import: "/rag/import",
} as const

export const RagApi = HttpApi.make("rag")
  .add(
    HttpApiGroup.make("rag")
      .add(
        HttpApiEndpoint.get("status", RagPaths.status, {
          success: described(RagStatus, "Local NE RAG index status"),
          error: RagRequestError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "rag.status",
            summary: "Get RAG status",
            description: "Get local NE RAG index status for the desktop app.",
          }),
        ),
        HttpApiEndpoint.post("import", RagPaths.import, {
          payload: RagImportPayload,
          success: described(RagImportResponse, "Documents imported into the local NE RAG index"),
          error: [RagCredentialRequiredError, RagImportFailedApiError, RagRequestError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "rag.import",
            summary: "Import RAG documents",
            description: "Import local PDF, Markdown, or text files into the NE RAG index.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "rag",
          description: "Experimental HttpApi local NE RAG routes.",
        }),
      )
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )
