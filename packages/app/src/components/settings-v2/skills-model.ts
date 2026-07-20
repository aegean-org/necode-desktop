import type { AppSkillsResponse, OpencodeClient } from "@opencode-ai/sdk/v2/client"

export type SettingsSkillInfo = AppSkillsResponse[number]

type SkillSearchItem = {
  readonly name: string
  readonly description?: string
  readonly location: string
}

export type SettingsSkillInstallInput = {
  source: string
  scope: "global" | "local"
  replace: boolean
}

export class SettingsSkillConflict extends Error {
  constructor(
    readonly skill: string,
    readonly currentSource: string,
    readonly incomingSource: string,
  ) {
    super(`Skill ${skill} is already installed from ${currentSource}`)
  }
}

/** Loads the skills exposed to active sessions for the selected project. */
export async function loadSettingsSkills(directory: string | undefined, client: Pick<OpencodeClient, "app">) {
  if (!directory) throw new Error("No project directory available for Skill list")
  const result = await client.app.skills({ directory })
  if (!result.data) throw new Error("Skill list response missing data")
  return result.data
}

/** Installs standalone Skills and preserves structured cross-source conflicts for confirmation. */
export async function installSettingsSkill(
  directory: string | undefined,
  client: Pick<OpencodeClient, "app">,
  input: SettingsSkillInstallInput,
) {
  if (!directory) throw new Error("No project directory available for Skill installation")
  const result = await client.app.skillInstall({ directory, ...input })
  if (result.data) return result.data
  if (isConflict(result.error)) {
    throw new SettingsSkillConflict(result.error.name, result.error.currentSource, result.error.incomingSource)
  }
  throw requestError(result.error, "Skill installation failed")
}

/** Removes one Skill that was installed through the managed Skill installer. */
export async function removeSettingsSkill(
  directory: string | undefined,
  client: Pick<OpencodeClient, "app">,
  name: string,
) {
  if (!directory) throw new Error("No project directory available for Skill removal")
  const result = await client.app.skillRemove({ directory, name })
  if (result.data) return result.data
  throw requestError(result.error, "Skill removal failed")
}

/** Returns Skills that became newly visible or changed ownership after an installation. */
export function changedSettingsSkills(before: readonly SettingsSkillInfo[], after: readonly SettingsSkillInfo[]) {
  const previous = new Map(before.map((item) => [item.name, item]))
  return after
    .filter((item) => {
      if (!item.canUninstall) return false
      const current = previous.get(item.name)
      if (!current) return true
      return (
        current.location !== item.location ||
        current.source !== item.source ||
        current.scope !== item.scope ||
        current.installSource !== item.installSource
      )
    })
    .toSorted((a, b) => a.name.localeCompare(b.name))
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

function isConflict(value: unknown): value is {
  _tag: "SkillManagedConflictError"
  name: string
  currentSource: string
  incomingSource: string
} {
  if (!value || typeof value !== "object") return false
  return "_tag" in value && value._tag === "SkillManagedConflictError"
}

function requestError(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "message" in value) return new Error(String(value.message))
  return new Error(fallback)
}
