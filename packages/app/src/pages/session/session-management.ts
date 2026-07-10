import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

type SessionManagementInput = {
  readonly client: Pick<OpencodeClient, "session">
  readonly directory: string
  readonly now?: () => number
}

/** Creates persisted session-management operations for one project directory. */
export function createSessionManagement(input: SessionManagementInput) {
  const updateTime = async (sessionID: string, time: { archived?: number | null; pinned?: number | null }) => {
    const result = await input.client.session.update(
      { directory: input.directory, sessionID, time },
      { throwOnError: true },
    )
    if (!result.data) throw new Error("Session update response missing data")
    return result.data
  }

  return {
    pin: (sessionID: string) => updateTime(sessionID, { pinned: (input.now ?? Date.now)() }),
    unpin: (sessionID: string) => updateTime(sessionID, { pinned: null }),
    archive: (sessionID: string) => updateTime(sessionID, { archived: (input.now ?? Date.now)() }),
    restore: (sessionID: string) => updateTime(sessionID, { archived: null }),
    remove: async (sessionID: string) => {
      const result = await input.client.session.delete(
        { directory: input.directory, sessionID },
        { throwOnError: true },
      )
      if (result.data !== true) throw new Error("Session delete response missing success confirmation")
      return true
    },
  }
}
