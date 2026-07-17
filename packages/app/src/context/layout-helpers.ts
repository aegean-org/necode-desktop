import type { Accessor } from "solid-js"
import { pathKey } from "@/utils/path-key"

export function ensureSessionKey(key: string, touch: (key: string) => void, seed: (key: string) => void) {
  touch(key)
  seed(key)
  return key
}

export function createSessionKeyReader(sessionKey: string | Accessor<string>, ensure: (key: string) => void) {
  const key = typeof sessionKey === "function" ? sessionKey : () => sessionKey
  return () => {
    const value = key()
    ensure(value)
    return value
  }
}

export function pruneSessionKeys(input: {
  keep?: string
  max: number
  used: Map<string, number>
  view: string[]
  tabs: string[]
}) {
  if (!input.keep) return []

  const keys = new Set<string>([...input.view, ...input.tabs])
  if (keys.size <= input.max) return []

  const score = (key: string) => {
    if (key === input.keep) return Number.MAX_SAFE_INTEGER
    return input.used.get(key) ?? 0
  }

  return Array.from(keys)
    .sort((a, b) => score(b) - score(a))
    .slice(input.max)
}

export function duplicateProjectDirectories(projects: { worktree: string; projectID?: string }[]) {
  const seen = new Set<string>()
  return projects.flatMap((project) => {
    if (!project.projectID) return []
    if (seen.has(project.projectID)) return [project.worktree]
    seen.add(project.projectID)
    return []
  })
}

export function projectWorkspaceDirectories(
  worktree: string,
  metadata: { worktree: string; sandboxes?: string[] } | undefined,
) {
  if (!metadata) return []
  const selected = pathKey(worktree)
  const seen = new Set<string>()
  return [metadata.worktree, ...(metadata.sandboxes ?? [])].filter((directory) => {
    const key = pathKey(directory)
    if (key === selected || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
