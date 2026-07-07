import { Auth } from "@/auth"
import { NE_PROVIDER_ID } from "@/ne/constants"
import {
  importNeRagPath,
  NeRagCredentialRequiredError,
  NeRagImportFailedError,
  readNeRagStatus,
} from "@/ne/rag/service"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import {
  RagCredentialRequiredError,
  RagImportFailedApiError,
  RagImportPayload,
  RagRequestError,
} from "../groups/rag"

export const ragHandlers = HttpApiBuilder.group(InstanceHttpApi, "rag", (handlers) =>
  Effect.gen(function* () {
    const auth = yield* Auth.Service

    const status = Effect.fn("RagHttpApi.status")(function* () {
      return yield* Effect.tryPromise({
        try: () => readNeRagStatus(),
        catch: toRagRequestError,
      })
    })

    const importPath = Effect.fn("RagHttpApi.import")(function* (ctx: { payload: typeof RagImportPayload.Type }) {
      const credential = yield* auth.get(NE_PROVIDER_ID).pipe(Effect.orDie)
      return yield* Effect.tryPromise({
        try: () => importNeRagPath({ inputPath: ctx.payload.path, credential }),
        catch: toRagApiError,
      })
    })

    return handlers.handle("status", status).handle("import", importPath)
  }),
)

function toRagApiError(error: unknown) {
  if (error instanceof NeRagCredentialRequiredError) {
    return new RagCredentialRequiredError({ message: error.message })
  }
  if (error instanceof NeRagImportFailedError) {
    return new RagImportFailedApiError({ message: error.message, failures: [...error.result.failures] })
  }
  return new RagRequestError({ message: error instanceof Error ? error.message : String(error) })
}

function toRagRequestError(error: unknown) {
  return new RagRequestError({ message: error instanceof Error ? error.message : String(error) })
}
