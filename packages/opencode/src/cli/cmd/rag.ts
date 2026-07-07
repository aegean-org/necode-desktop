import type { Argv } from "yargs"
import path from "node:path"
import { Auth } from "@/auth"
import { NE_PROVIDER_ID, NE_PROVIDER_NAME } from "@/ne/constants"
import { NeRagIndexer } from "@/ne/rag/indexer"
import { resolveNeRagStorePath } from "@/ne/rag/context"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"
import * as Prompt from "../effect/prompt"
import { Effect } from "effect"

export const RagCommand = cmd({
  command: "rag",
  describe: "manage the local NE RAG index",
  builder: (yargs) => yargs.command(RagImportCommand).demandCommand(),
  async handler() {},
})

export const RagImportCommand = effectCmd({
  command: "import <path>",
  describe: "index .pdf, .md, and .txt documents with NE embeddings",
  instance: false,
  builder: (yargs: Argv) =>
    yargs.positional("path", {
      describe: "file or directory to index",
      type: "string",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.rag.import")(function* (args) {
    const credential = yield* Auth.Service.use((auth) => auth.get(NE_PROVIDER_ID)).pipe(Effect.orDie)
    if (!credential || credential.type !== "api") {
      return yield* fail(`NE RAG import requires ${NE_PROVIDER_NAME} credentials.`)
    }

    const inputPath = path.resolve(args.path)
    const storePath = resolveNeRagStorePath()
    yield* Prompt.intro(`NE RAG import ${inputPath}`)
    const result = yield* Effect.tryPromise({
      try: () =>
        new NeRagIndexer({
          storePath,
          getApiKey: async () => credential.key,
        }).indexPath(inputPath),
      catch: (error) => new Error(error instanceof Error ? error.message : String(error)),
    }).pipe(Effect.catch((error) => fail(error.message)))

    if (result.failedFiles > 0) {
      for (const failure of result.failures) yield* Prompt.log.error(`${failure.filePath}: ${failure.error}`)
      return yield* fail(`NE RAG import failed for ${result.failedFiles} of ${result.files} file(s).`)
    }

    yield* Prompt.outro(`Indexed ${result.indexedFiles} file(s), ${result.chunks} chunk(s) into ${storePath}`)
  }),
})
