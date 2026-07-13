import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Effect } from "effect"

/** Builds the model-facing task tool description from currently available subagents. */
export function taskDescription(agents: Agent.Interface, agent: Agent.Info) {
  return Effect.gen(function* () {
    const items = (yield* agents.list()).filter((item) => item.mode !== "primary")
    const visible = items.filter((item) => Permission.evaluate("task", item.name, agent.permission).action !== "deny")
    const description = visible
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((item) => `- ${item.name}: ${item.description ?? "This subagent should only be called manually by the user."}`)
      .join("\n")
    return ["Available agent types and the tools they have access to:", description].join("\n")
  })
}
