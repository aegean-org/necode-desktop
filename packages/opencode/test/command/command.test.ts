import { describe, expect } from "bun:test"
import path from "path"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Effect, Layer } from "effect"
import { Command } from "../../src/command"
import { provideTmpdirInstance, testInstanceStoreLayer } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(Command.defaultLayer, CrossSpawnSpawner.defaultLayer, testInstanceStoreLayer))

describe("command", () => {
  it.live("discovers skill commands added after the first command list", () =>
    provideTmpdirInstance(
      (directory) =>
        Effect.gen(function* () {
          const command = yield* Command.Service
          expect((yield* command.list()).map((item) => item.name)).not.toContain("late-command")

          yield* Effect.promise(() =>
            Bun.write(
              path.join(directory, ".opencode", "skills", "late-command", "SKILL.md"),
              `---
name: late-command
description: Added after command initialization.
---

# Late Command
`,
            ),
          )

          expect(yield* command.get("late-command")).toMatchObject({
            name: "late-command",
            source: "skill",
          })
          expect((yield* command.list()).map((item) => item.name)).toContain("late-command")
        }),
      { git: true },
    ),
  )
})
