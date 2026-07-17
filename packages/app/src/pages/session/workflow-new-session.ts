import type { Session } from "@opencode-ai/sdk/v2/client"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { Binary } from "@opencode-ai/core/util/binary"

export async function createWorkflowSession(input: {
  directory: string
  create: () => Promise<{ data?: Session | null }>
  seed: (session: Session) => void
  navigate: (href: string) => void
}) {
  const response = await input.create()
  if (!response.data) throw new Error("Session create response missing data")

  input.seed(response.data)
  input.navigate(`/${base64Encode(input.directory)}/session/${response.data.id}`)
  return response.data
}

export function insertWorkflowSession(sessions: Session[], session: Session) {
  const result = Binary.search(sessions, session.id, (item) => item.id)
  const next = [...sessions]
  if (result.found) {
    next[result.index] = session
    return next
  }
  next.splice(result.index, 0, session)
  return next
}
