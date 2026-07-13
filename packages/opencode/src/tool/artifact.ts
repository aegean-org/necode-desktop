import { Global } from "@opencode-ai/core/global"
import { mkdir } from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

export namespace ToolArtifact {
  /** Allocate an empty session-scoped path for a plugin-generated artifact. */
  export async function allocate(sessionID: string, filename: string, dataDir = Global.Path.data) {
    if (!filename || path.basename(filename) !== filename) throw new TypeError(`Invalid artifact filename: ${filename}`)
    const root = path.join(dataDir, "artifacts", sessionID)
    await mkdir(root, { recursive: true })
    const target = path.join(root, filename)
    return { path: target, url: pathToFileURL(target).href }
  }
}
