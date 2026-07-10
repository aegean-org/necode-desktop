import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

type SkillSearchItem = {
  readonly name: string
  readonly description?: string
  readonly location: string
}

/** Loads the skills exposed to active sessions for the selected project. */
export async function loadSettingsSkills(directory: string | undefined, client: Pick<OpencodeClient, "app">) {
  if (!directory) throw new Error("No project directory available for Skill list")
  const result = await client.app.skills({ directory })
  if (!result.data) throw new Error("Skill list response missing data")
  return result.data
}

/**
 * Filters the Settings Skills list with predictable substring matching.
 */
export function filterSettingsSkills<T extends SkillSearchItem>(items: readonly T[], filter: string) {
  const query = filter.trim().toLowerCase()
  const filtered = query ? items.filter((item) => skillSearchText(item).includes(query)) : items
  return filtered.toSorted((a, b) => a.name.localeCompare(b.name))
}

function skillSearchText(item: SkillSearchItem) {
  return [item.name, item.description ?? "", item.location].join("\n").toLowerCase()
}
