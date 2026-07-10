import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { SkillPlugin } from "@opencode-ai/core/plugin/skill"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SkillV2 } from "@opencode-ai/core/skill"
import { SkillDiscovery } from "@opencode-ai/core/skill/discovery"
import { testEffect } from "../lib/effect"

const it = testEffect(
  SkillV2.layer.pipe(
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(SkillDiscovery.defaultLayer),
    Layer.provideMerge(AgentV2.locationLayer),
  ),
)

describe("SkillPlugin.Plugin", () => {
  it.effect("registers the built-in customize-necode skill", () =>
    Effect.gen(function* () {
      const skill = yield* SkillV2.Service
      yield* SkillPlugin.Plugin.effect.pipe(Effect.provideService(SkillV2.Service, skill))

      const item = (yield* skill.list()).find((item) => item.name === "customize-necode")
      expect(item).toEqual(
        expect.objectContaining({
          name: "customize-necode",
          description: expect.stringContaining("installing or importing skills"),
          location: AbsolutePath.make("/builtin/customize-necode.md"),
        }),
      )
      expect(item?.content).toContain("not a fixed or system-predefined catalog")
      expect(item?.content).toContain("obra/superpowers/refs/heads/main/.opencode/INSTALL.md")
      expect(item?.content).toContain('Call the product "NeCode" in user-facing responses')
      expect(item?.content).toMatch(/Check both `opencode\.json` and\s+`opencode\.jsonc`/)
      expect(item?.content).toMatch(/Resolve the active global config\s+directory from `OPENCODE_CONFIG_DIR`/)
    }),
  )
})
