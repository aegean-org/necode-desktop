import { describe, expect } from "bun:test"
import path from "node:path"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Ref } from "effect"
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
    "renames an entry with one write while preserving JSONC comments",
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
      const writes = yield* Ref.make(0)
      const tracked = FSUtil.Service.of({
        ...fs,
        writeWithDirs: (target, content, mode) =>
          Ref.update(writes, (count) => count + 1).pipe(Effect.andThen(fs.writeWithDirs(target, content, mode))),
      })

      yield* MCPConfigFile.rename({
        fs: tracked,
        path: source,
        from: "old",
        to: "renamed",
        config: { type: "remote", url: "https://example.com/renamed" },
      })

      expect(yield* Ref.get(writes)).toBe(1)
      const text = yield* fs.readFileString(source)
      expect(text).toContain("// keep this comment")
      expect(parse(text).theme).toBe("necode")
      expect(parse(text).mcp).toEqual({
        renamed: { type: "remote", url: "https://example.com/renamed" },
      })
    }),
  )

  test(
    "rejects rename when the old key is missing or the new key exists",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(
        source,
        JSON.stringify({
          mcp: {
            old: { type: "local", command: ["echo", "old"] },
            taken: { type: "local", command: ["echo", "taken"] },
          },
        }),
      )

      const missing = yield* MCPConfigFile.rename({
        fs,
        path: source,
        from: "missing",
        to: "renamed",
        config: { type: "local", command: ["echo", "renamed"] },
      }).pipe(Effect.flip)
      expect(missing._tag).toBe("MCPConfigFile.NotFoundError")

      const conflict = yield* MCPConfigFile.rename({
        fs,
        path: source,
        from: "old",
        to: "taken",
        config: { type: "local", command: ["echo", "renamed"] },
      }).pipe(Effect.flip)
      expect(conflict._tag).toBe("MCPConfigFile.ConflictError")
      expect(conflict).toMatchObject({ path: source, name: "taken" })
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

  test(
    "treats inherited object names as missing MCP entries",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(source, `{ "mcp": {} }`)

      const toStringError = yield* MCPConfigFile.remove({ fs, path: source, name: "toString" }).pipe(Effect.flip)
      expect(toStringError).toBeInstanceOf(MCPConfigFile.NotFoundError)
      expect(toStringError.name).toBe("toString")

      const constructorError = yield* MCPConfigFile.remove({ fs, path: source, name: "constructor" }).pipe(Effect.flip)
      expect(constructorError).toBeInstanceOf(MCPConfigFile.NotFoundError)
      expect(constructorError.name).toBe("constructor")
    }),
  )

  test(
    "preserves a __proto__ MCP entry when removing another entry",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(
        source,
        `{
  "mcp": {
    "__proto__": { "type": "remote", "url": "https://example.com/proto" },
    "other": { "type": "remote", "url": "https://example.com/other" }
  }
}`,
      )

      const before = yield* MCPConfigFile.read({ fs, path: source })
      expect(Object.hasOwn(before.mcp, "__proto__")).toBe(true)

      yield* MCPConfigFile.remove({ fs, path: source, name: "other" })

      const text = yield* fs.readFileString(source)
      expect(text).toContain('"__proto__"')
      expect(text).not.toContain('"other"')
      const after = yield* MCPConfigFile.read({ fs, path: source })
      expect(Object.hasOwn(after.mcp, "__proto__")).toBe(true)
      expect(Object.hasOwn(after.mcp, "other")).toBe(false)
    }),
  )

  test(
    "ignores an inherited root mcp and preserves the top-level __proto__ property",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const tmp = yield* fs.makeTempDirectoryScoped()
      const source = path.join(tmp, "opencode.jsonc")
      yield* fs.writeFileString(
        source,
        `{
  "__proto__": {
    "mcp": {
      "shadow": { "type": "remote", "url": "https://example.com/shadow" }
    }
  },
  "theme": "necode"
}`,
      )

      const before = yield* MCPConfigFile.read({ fs, path: source })
      expect(Object.keys(before.mcp)).toEqual([])

      yield* MCPConfigFile.set({
        fs,
        path: source,
        name: "remote",
        config: { type: "remote", url: "https://example.com/mcp" },
      })

      const text = yield* fs.readFileString(source)
      expect(text).toContain('"__proto__"')
      expect(parse(text).theme).toBe("necode")
      const after = yield* MCPConfigFile.read({ fs, path: source })
      expect(Object.hasOwn(after.mcp, "remote")).toBe(true)
      expect(Object.hasOwn(after.mcp, "shadow")).toBe(false)
    }),
  )
})
