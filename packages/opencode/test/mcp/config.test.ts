import { describe, expect } from "bun:test"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect } from "effect"
import path from "node:path"
import { MCPConfig } from "@/mcp/config"
import { MCPConfigSource } from "@/mcp/config-source"
import { requireInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const { instance: test } = testEffect(FSUtil.defaultLayer)

describe("MCPConfig", () => {
  test(
    "lists builtins and persists scoped entries with project precedence",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const ctx = yield* requireInstance
      const globalConfigDir = path.join(ctx.worktree, ".global")
      const manager = MCPConfig.make({ fs, globalConfigDir })

      expect((yield* manager.list(ctx)).filter((item) => item.readonly).map((item) => item.name)).toEqual([
        "noteexpress",
        "qingtibase",
      ])

      yield* manager.create(ctx, {
        scope: "global",
        name: "shared",
        config: { type: "remote", url: "https://global.example/mcp" },
      })
      yield* manager.create(ctx, {
        scope: "project",
        name: "shared",
        config: { type: "local", command: ["npx", "-y", "@example/shared"] },
      })

      const rows = (yield* manager.list(ctx)).filter((item) => item.name === "shared")
      expect(rows.map((item) => [item.scope, item.effective])).toEqual([
        ["global", false],
        ["project", true],
      ])
      expect(rows[0].overriddenBy).toBe("project")
      expect(yield* fs.exists(path.join(globalConfigDir, "opencode.json"))).toBe(true)
      expect(yield* fs.exists(path.join(ctx.worktree, "opencode.json"))).toBe(true)
      expect(yield* fs.exists(path.join(ctx.worktree, "config.json"))).toBe(false)
    }),
    { git: true },
  )

  test(
    "rejects same-scope conflicts and every reserved-name mutation",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const ctx = yield* requireInstance
      const globalConfigDir = path.join(ctx.worktree, ".global")
      const manager = MCPConfig.make({ fs, globalConfigDir })
      yield* fs.writeWithDirs(
        path.join(globalConfigDir, "config.json"),
        JSON.stringify({ mcp: { duplicate: remote("https://one.example/mcp") } }),
      )
      yield* fs.writeWithDirs(
        path.join(ctx.worktree, "opencode.json"),
        JSON.stringify({
          mcp: { noteexpress: remote("https://manual.example/mcp"), mutable: remote("https://m.example") },
        }),
      )

      const conflict = yield* manager
        .create(ctx, { scope: "global", name: "duplicate", config: remote("https://two.example/mcp") })
        .pipe(Effect.flip)
      expect(conflict._tag).toBe("MCPConfigConflictError")
      expect(conflict).toMatchObject({ name: "duplicate", scope: "global" })

      const createReserved = yield* manager
        .create(ctx, { scope: "project", name: "noteexpress", config: remote("https://new.example/mcp") })
        .pipe(Effect.flip)
      expect(createReserved._tag).toBe("MCPConfigInvalidError")

      const entries = yield* manager.list(ctx)
      const noteexpress = entries.find((item) => item.name === "noteexpress")!
      const qingtibase = entries.find((item) => item.name === "qingtibase")!
      expect(noteexpress).toMatchObject({ scope: "project", readonly: true })
      expect(entries.filter((item) => item.name === "noteexpress")).toHaveLength(1)
      expect(
        (yield* manager.update(ctx, noteexpress.id, { name: "renamed", config: noteexpress.config }).pipe(Effect.flip))
          ._tag,
      ).toBe("MCPConfigInvalidError")
      expect((yield* manager.remove(ctx, noteexpress.id).pipe(Effect.flip))._tag).toBe("MCPConfigInvalidError")
      expect((yield* manager.remove(ctx, qingtibase.id).pipe(Effect.flip))._tag).toBe("MCPConfigInvalidError")

      const mutable = entries.find((item) => item.name === "mutable")!
      expect(
        (yield* manager.update(ctx, mutable.id, { name: "qingtibase", config: mutable.config }).pipe(Effect.flip))._tag,
      ).toBe("MCPConfigInvalidError")
    }),
    { git: true },
  )

  test(
    "renames and removes only the encoded source while rejecting stale or forged IDs",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const ctx = yield* requireInstance
      const globalConfigDir = path.join(ctx.worktree, ".global")
      const manager = MCPConfig.make({ fs, globalConfigDir })
      const json = path.join(ctx.worktree, "opencode.json")
      const jsonc = path.join(ctx.worktree, "opencode.jsonc")
      yield* fs.writeFileString(json, JSON.stringify({ mcp: { low: remote("https://low.example/mcp") } }))
      yield* fs.writeFileString(jsonc, JSON.stringify({ mcp: { high: remote("https://high.example/mcp") } }))

      const before = yield* manager.list(ctx)
      const low = before.find((item) => item.name === "low")!
      const high = before.find((item) => item.name === "high")!
      const renamed = yield* manager.update(ctx, low.id, {
        name: "renamed",
        config: remote("https://renamed.example/mcp"),
      })
      expect(renamed.find((item) => item.name === "renamed")).toMatchObject({ scope: "project", source: json })
      expect(yield* fs.readFileString(json)).toContain('"renamed"')
      expect(yield* fs.readFileString(json)).not.toContain('"low"')
      expect(yield* fs.readFileString(jsonc)).toContain('"high"')

      yield* manager.remove(ctx, high.id)
      expect(yield* fs.readFileString(jsonc)).not.toContain('"high"')
      expect((yield* manager.remove(ctx, high.id).pipe(Effect.flip))._tag).toBe("MCPConfigNotFoundError")
      expect((yield* manager.remove(ctx, `${low.id}!`).pipe(Effect.flip))._tag).toBe("MCPConfigNotFoundError")

      const forged = MCPConfigSource.encodeEntryID({
        scope: "project",
        source: path.join(ctx.worktree, "outside.json"),
        name: "renamed",
      })
      expect((yield* manager.remove(ctx, forged).pipe(Effect.flip))._tag).toBe("MCPConfigNotFoundError")
    }),
    { git: true },
  )

  test(
    "maps invalid documents and filesystem reads to public failures",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const ctx = yield* requireInstance
      const globalConfigDir = path.join(ctx.worktree, ".global")
      const manager = MCPConfig.make({ fs, globalConfigDir })
      yield* fs.writeWithDirs(path.join(ctx.worktree, "opencode.json"), `{ "mcp": {`)

      const invalid = yield* manager.list(ctx).pipe(Effect.flip)
      expect(invalid._tag).toBe("MCPConfigInvalidError")
      expect(invalid.message).toContain("Invalid JSONC")

      yield* fs.remove(path.join(ctx.worktree, "opencode.json"))
      yield* fs.makeDirectory(path.join(ctx.worktree, "opencode.json"))
      const persistence = yield* manager
        .create(ctx, { scope: "project", name: "blocked", config: remote("https://blocked.example/mcp") })
        .pipe(Effect.flip)
      expect(persistence._tag).toBe("MCPConfigPersistenceError")
      if (persistence._tag !== "MCPConfigPersistenceError") return yield* Effect.die(persistence)
      expect(persistence.path).toBe(path.join(ctx.worktree, "opencode.json"))
      expect(persistence.cause).toBeDefined()
    }),
    { git: true },
  )
})

function remote(url: string) {
  return { type: "remote" as const, url }
}
