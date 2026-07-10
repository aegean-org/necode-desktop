import { describe, expect } from "bun:test"
import path from "node:path"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect } from "effect"
import { parse } from "jsonc-parser"
import { MCPConfigFile } from "@/mcp/config-file"
import { testEffect } from "../lib/effect"

const { effect: test } = testEffect(FSUtil.defaultLayer)

describe("MCPConfigFile", () => {
  test(
    "preserves unrelated JSONC content and removes an empty mcp object",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(
        source,
        `{
  // keep this comment
  "theme": "necode",
  "mcp": {
    "old": { "type": "local", "command": ["echo", "old"] }
  }
}`,
      )

      const document = yield* MCPConfigFile.read({ fs, path: source })
      expect(document.path).toBe(source)
      expect(document.text).toContain("// keep this comment")
      expect(document.mcp.old).toEqual({ type: "local", command: ["echo", "old"] })

      yield* MCPConfigFile.set({
        fs,
        path: source,
        name: "remote",
        config: { type: "remote", url: "https://example.com/mcp" },
      })
      expect(yield* fs.readFileString(source)).toContain("// keep this comment")
      expect(parse(yield* fs.readFileString(source)).theme).toBe("necode")

      yield* MCPConfigFile.remove({ fs, path: source, name: "old" })
      yield* MCPConfigFile.remove({ fs, path: source, name: "remote" })
      expect(parse(yield* fs.readFileString(source)).mcp).toBeUndefined()
    }),
  )

  test(
    "fails explicitly for damaged JSONC",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(source, `{ "mcp": {`)

      const error = yield* MCPConfigFile.read({ fs, path: source }).pipe(Effect.flip)
      expect(error._tag).toBe("MCPConfigFile.ParseError")
      expect(error.path).toBe(source)
      expect(error.message).toContain("Invalid JSONC")
      expect(error.cause).toBeDefined()
    }),
  )

  test(
    "fails explicitly for an invalid MCP schema",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(source, `{ "mcp": { "broken": { "type": "remote" } } }`)

      const error = yield* MCPConfigFile.read({ fs, path: source }).pipe(Effect.flip)
      expect(error._tag).toBe("MCPConfigFile.ParseError")
      expect(error.path).toBe(source)
      expect(error.message).toContain('Invalid MCP config "broken"')
      expect(error.cause).toBeDefined()
    }),
  )

  test(
    "fails explicitly when removing a missing MCP entry",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(source, `{ "theme": "necode" }`)

      const error = yield* MCPConfigFile.remove({ fs, path: source, name: "missing" }).pipe(Effect.flip)
      expect(error._tag).toBe("MCPConfigFile.NotFoundError")
      expect(error.path).toBe(source)
      expect(error.name).toBe("missing")
      expect(error.message).toContain("missing")
    }),
  )
})
