import { Agent } from "@/agent/agent"
import { Command } from "@/command"
import * as InstanceState from "@/effect/instance-state"
import { Format } from "@/format"
import { Global } from "@opencode-ai/core/global"
import { LSP } from "@/lsp/lsp"
import { Vcs } from "@/project/vcs"
import { Skill } from "@/skill"
import { SkillManaged } from "@/skill/managed"
import { Discovery } from "@/skill/discovery"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Git } from "@/git"
import path from "node:path"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ApiVcsApplyError } from "../groups/instance"
import { markInstanceForDisposal } from "../lifecycle"

export const instanceHandlers = HttpApiBuilder.group(InstanceHttpApi, "instance", (handlers) =>
  Effect.gen(function* () {
    const agent = yield* Agent.Service
    const command = yield* Command.Service
    const format = yield* Format.Service
    const lsp = yield* LSP.Service
    const skill = yield* Skill.Service
    const discovery = yield* Discovery.Service
    const manager = SkillManaged.make({
      fs: yield* FSUtil.Service,
      git: yield* Git.Service,
      globalConfigDir: Flag.OPENCODE_CONFIG_DIR ?? Global.Path.config,
      cacheDir: path.join(Global.Path.cache, "skill-installs"),
      pull: (url) => discovery.pull(url, { refresh: true }),
    })
    const vcs = yield* Vcs.Service

    const dispose = Effect.fn("InstanceHttpApi.dispose")(function* () {
      yield* markInstanceForDisposal(yield* InstanceState.context)
      return true
    })

    const getPath = Effect.fn("InstanceHttpApi.path")(function* () {
      const ctx = yield* InstanceState.context
      return {
        home: Global.Path.home,
        state: Global.Path.state,
        config: Global.Path.config,
        worktree: ctx.worktree,
        directory: ctx.directory,
      }
    })

    const getVcs = Effect.fn("InstanceHttpApi.vcs")(function* () {
      const [branch, default_branch] = yield* Effect.all([vcs.branch(), vcs.defaultBranch()], {
        concurrency: "unbounded",
      })
      return { branch, default_branch }
    })

    const getVcsStatus = Effect.fn("InstanceHttpApi.vcsStatus")(function* () {
      return yield* vcs.status()
    })

    const getVcsDiff = Effect.fn("InstanceHttpApi.vcsDiff")(function* (ctx: {
      query: { mode: Vcs.Mode; context?: number }
    }) {
      return yield* vcs.diff(ctx.query.mode, { context: ctx.query.context })
    })

    const getVcsDiffRaw = Effect.fn("InstanceHttpApi.vcsDiffRaw")(function* () {
      return yield* vcs.diffRaw()
    })

    const applyVcs = Effect.fn("InstanceHttpApi.vcsApply")(function* (ctx: { payload: Vcs.ApplyInput }) {
      return yield* vcs.apply(ctx.payload).pipe(
        Effect.mapError(
          (error) =>
            new ApiVcsApplyError({
              name: "VcsApplyError",
              data: {
                message: error.message,
                reason: error.reason,
              },
            }),
        ),
      )
    })

    const getCommand = Effect.fn("InstanceHttpApi.command")(function* () {
      return yield* command.list()
    })

    const getAgent = Effect.fn("InstanceHttpApi.agent")(function* () {
      return yield* agent.list()
    })

    const getSkill = Effect.fn("InstanceHttpApi.skill")(function* () {
      return yield* skill.all()
    })

    const installSkill = Effect.fn("InstanceHttpApi.skillInstall")(function* (ctx: {
      payload: typeof SkillManaged.InstallInput.Type
    }) {
      const instance = yield* InstanceState.context
      const installed = yield* manager.install(instance, ctx.payload)
      const list = yield* skill.all()
      const missing = installed.skills.filter(
        (name) =>
          !list.some((item) => item.name === name && item.canUninstall && item.installSource === installed.source),
      )
      if (missing.length) {
        return yield* new SkillManaged.InstallError({
          stage: "verification",
          message: `Installed Skill files were not discovered: ${missing.join(", ")}`,
        })
      }
      return list
    })

    const removeSkill = Effect.fn("InstanceHttpApi.skillRemove")(function* (ctx: { params: { name: string } }) {
      yield* manager.remove(yield* InstanceState.context, ctx.params.name)
      return yield* skill.all()
    })

    const getLsp = Effect.fn("InstanceHttpApi.lsp")(function* () {
      return yield* lsp.status()
    })

    const getFormatter = Effect.fn("InstanceHttpApi.formatter")(function* () {
      return yield* format.status()
    })

    return handlers
      .handle("dispose", dispose)
      .handle("path", getPath)
      .handle("vcs", getVcs)
      .handle("vcsStatus", getVcsStatus)
      .handle("vcsDiff", getVcsDiff)
      .handle("vcsDiffRaw", getVcsDiffRaw)
      .handle("vcsApply", applyVcs)
      .handle("command", getCommand)
      .handle("agent", getAgent)
      .handle("skill", getSkill)
      .handle("skillInstall", installSkill)
      .handle("skillRemove", removeSkill)
      .handle("lsp", getLsp)
      .handle("formatter", getFormatter)
  }),
)
