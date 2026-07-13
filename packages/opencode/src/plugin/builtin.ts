import type { Plugin } from "@opencode-ai/plugin"
import { InstallationChannel } from "@opencode-ai/core/installation/version"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { NePlugin } from "@/ne/plugin"
import { AzureAuthPlugin } from "./azure"
import { CloudflareAIGatewayAuthPlugin, CloudflareWorkersAuthPlugin } from "./cloudflare"
import { DigitalOceanAuthPlugin } from "./digitalocean"
import { CopilotAuthPlugin } from "./github-copilot/copilot"
import { CodexAuthPlugin } from "./openai/codex"
import { SnowflakeCortexAuthPlugin } from "./snowflake-cortex"
import { XaiAuthPlugin } from "./xai"
import type { PluginCatalog } from "./catalog"
import { gitlabAuthPlugin as GitlabAuthPlugin } from "opencode-gitlab-auth"
import { PoeAuthPlugin } from "opencode-poe-auth"

type DefinitionInput = {
  key: `builtin:${string}`
  id: string
  name: string
  description: string
  server: Plugin
}

const system = (input: DefinitionInput): PluginCatalog.Builtin => ({
  key: input.key,
  manifest: { id: input.id, name: input.name, description: input.description },
  server: input.server,
  system: true,
  canDisable: false,
})

const staticPlugins = [
  system({ key: "builtin:copilot-auth", id: "copilot-auth", name: "GitHub Copilot Auth", description: "GitHub Copilot authentication", server: CopilotAuthPlugin }),
  system({ key: "builtin:gitlab-auth", id: "gitlab-auth", name: "GitLab Auth", description: "GitLab authentication", server: GitlabAuthPlugin }),
  system({ key: "builtin:poe-auth", id: "poe-auth", name: "Poe Auth", description: "Poe authentication", server: PoeAuthPlugin }),
  system({ key: "builtin:cloudflare-workers", id: "cloudflare-workers", name: "Cloudflare Workers AI", description: "Cloudflare Workers AI authentication", server: CloudflareWorkersAuthPlugin }),
  system({ key: "builtin:cloudflare-gateway", id: "cloudflare-gateway", name: "Cloudflare AI Gateway", description: "Cloudflare AI Gateway authentication", server: CloudflareAIGatewayAuthPlugin }),
  system({ key: "builtin:azure", id: "azure", name: "Azure", description: "Azure provider authentication", server: AzureAuthPlugin }),
  system({ key: "builtin:digitalocean", id: "digitalocean", name: "DigitalOcean", description: "DigitalOcean provider authentication", server: DigitalOceanAuthPlugin }),
  system({ key: "builtin:snowflake", id: "snowflake", name: "Snowflake Cortex", description: "Snowflake Cortex provider authentication", server: SnowflakeCortexAuthPlugin }),
  system({ key: "builtin:xai", id: "xai", name: "xAI", description: "xAI provider authentication", server: XaiAuthPlugin }),
  system({ key: "builtin:necode", id: "necode", name: "NeCode", description: "NeCode system integration", server: NePlugin }),
] as const

export namespace BuiltinPlugins {
  /** Returns system-owned plugins that must participate in the current runtime. */
  export function list(flags: RuntimeFlags.Info): readonly PluginCatalog.Builtin[] {
    return [codex(flags), ...staticPlugins]
  }

  function codex(flags: RuntimeFlags.Info) {
    const server: Plugin = (input) =>
      CodexAuthPlugin(input, {
        experimentalWebSockets: experimentalWebSocketsEnabled({ enabled: flags.experimentalWebSockets }),
      })
    return system({ key: "builtin:codex-auth", id: "codex-auth", name: "Codex Auth", description: "OpenAI Codex authentication", server })
  }
}

/** Determines whether Codex authentication should opt into the websocket transport. */
export function experimentalWebSocketsEnabled(input: { enabled: boolean; channel?: string }) {
  return input.enabled || ["local", "dev", "beta"].includes(input.channel ?? InstallationChannel)
}
