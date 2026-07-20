import { describe, expect } from "bun:test"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Layer } from "effect"
import path from "node:path"
import { Git } from "@/git"
import { SkillManaged } from "@/skill/managed"
import { requireInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const { instance: test } = testEffect(Layer.merge(FSUtil.defaultLayer, Git.defaultLayer))

describe("SkillManaged", () => {
  test(
    "installs, updates, replaces, and removes only managed skills",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const git = yield* Git.Service
      const ctx = yield* requireInstance
      const manager = SkillManaged.make({
        fs,
        git,
        globalConfigDir: path.join(ctx.worktree, ".global"),
        cacheDir: path.join(ctx.worktree, ".cache"),
      })
      const first = path.join(ctx.worktree, "sources", "first")
      const second = path.join(ctx.worktree, "sources", "second")
      yield* createSkill(fs, first, "demo", "first", "one")
      yield* createSkill(fs, second, "demo", "second", "two")

      expect((yield* manager.install(ctx, { source: first, scope: "local", replace: false })).skills).toEqual(["demo"])
      const target = path.join(ctx.worktree, ".opencode", "skills", "demo")
      expect(yield* fs.readFileString(path.join(target, "support.txt"))).toBe("one")
      expect((yield* manager.list(ctx))[0]).toMatchObject({
        name: "demo",
        scope: "local",
        source: path.resolve(first),
        canUninstall: true,
      })

      yield* fs.writeFileString(path.join(first, "demo", "support.txt"), "updated")
      yield* manager.install(ctx, { source: first, scope: "local", replace: false })
      expect(yield* fs.readFileString(path.join(target, "support.txt"))).toBe("updated")

      const conflict = yield* manager.install(ctx, { source: second, scope: "local", replace: false }).pipe(Effect.flip)
      expect(conflict).toMatchObject({
        _tag: "SkillManagedConflictError",
        name: "demo",
        currentSource: path.resolve(first),
        incomingSource: path.resolve(second),
      })

      yield* manager.install(ctx, { source: second, scope: "local", replace: true })
      expect(yield* fs.readFileString(path.join(target, "support.txt"))).toBe("two")
      yield* manager.remove(ctx, "demo")
      expect(yield* fs.existsSafe(target)).toBe(false)
      expect((yield* manager.remove(ctx, "demo").pipe(Effect.flip))._tag).toBe("SkillManagedNotFoundError")
    }),
    { git: true },
  )

  test(
    "redirects plugin-backed skill packs to plugin management",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const git = yield* Git.Service
      const ctx = yield* requireInstance
      const manager = SkillManaged.make({
        fs,
        git,
        globalConfigDir: path.join(ctx.worktree, ".global"),
        cacheDir: path.join(ctx.worktree, ".cache"),
      })
      const source = path.join(ctx.worktree, "sources", "superpowers")
      yield* createSkill(fs, source, "brainstorming", "brainstorm", "support")
      yield* fs.writeFileString(
        path.join(source, "package.json"),
        JSON.stringify({ name: "superpowers", main: ".opencode/plugins/superpowers.js" }),
      )

      const failure = yield* manager.install(ctx, { source, scope: "global", replace: false }).pipe(Effect.flip)
      expect(failure).toMatchObject({
        _tag: "SkillManagedPluginRequiredError",
        pluginSpec: path.resolve(source),
      })
    }),
    { git: true },
  )

  test(
    "requires confirmation before moving a same-name Skill across scopes or sources",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const git = yield* Git.Service
      const ctx = yield* requireInstance
      const manager = SkillManaged.make({
        fs,
        git,
        globalConfigDir: path.join(ctx.worktree, ".global"),
        cacheDir: path.join(ctx.worktree, ".cache"),
      })
      const first = path.join(ctx.worktree, "sources", "global")
      const second = path.join(ctx.worktree, "sources", "local")
      yield* createSkill(fs, first, "scoped", "global source", "global")
      yield* createSkill(fs, second, "scoped", "local source", "local")
      yield* manager.install(ctx, { source: first, scope: "global", replace: false })
      expect(yield* fs.existsSafe(path.join(ctx.worktree, ".global", "skills", "scoped", "SKILL.md"))).toBe(true)
      expect(yield* fs.existsSafe(path.join(ctx.worktree, ".opencode", "skills", "scoped", "SKILL.md"))).toBe(false)

      const conflict = yield* manager.install(ctx, { source: second, scope: "local", replace: false }).pipe(Effect.flip)
      expect(conflict).toMatchObject({ _tag: "SkillManagedConflictError", name: "scoped" })

      yield* manager.install(ctx, { source: second, scope: "local", replace: true })
      expect(yield* fs.existsSafe(path.join(ctx.worktree, ".global", "skills", "scoped", "SKILL.md"))).toBe(false)
      expect(yield* fs.existsSafe(path.join(ctx.worktree, ".opencode", "skills", "scoped", "SKILL.md"))).toBe(true)
      expect((yield* manager.list(ctx)).filter((item) => item.name === "scoped")).toEqual([
        expect.objectContaining({ scope: "local", source: path.resolve(second) }),
      ])
    }),
    { git: true },
  )
})

function createSkill(fs: FSUtil.Interface, root: string, name: string, description: string, support: string) {
  return Effect.gen(function* () {
    const directory = path.join(root, name)
    yield* fs.writeWithDirs(
      path.join(directory, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    )
    yield* fs.writeFileString(path.join(directory, "support.txt"), support)
  })
}
