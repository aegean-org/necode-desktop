import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { Icon } from "@opencode-ai/ui/icon"
import { Show, type Component } from "solid-js"

export function computerUseEnabled(metadata: Record<string, unknown> | undefined, override: boolean | undefined) {
  if (override !== undefined) return override
  const value = metadata?.computerUse
  if (!value || typeof value !== "object") return false
  return "enabled" in value && value.enabled === true
}

export function computerUseOption(
  entry: PluginEntry,
  copy = {
    label: "@电脑 Computer Use",
    description: "控制 Windows 和 macOS 桌面应用",
    enableHint: "请先在设置 > 插件中启用 Computer Use",
  },
) {
  const available = entry.status === "active"
  return {
    type: "capability" as const,
    id: "computer-use" as const,
    display: "电脑 Computer Use computer desktop",
    label: copy.label,
    description:
      entry.error?.message ??
      (available ? copy.description : copy.enableHint),
    available,
    entry,
  }
}

export function trailingAtQuery(text: string, cursor: number) {
  const match = text.slice(0, cursor).match(/@(\S*)$/)
  if (!match) return
  return { start: match.index ?? cursor - match[0].length, end: cursor }
}

export function computerUseExitLabel(working: boolean) {
  return working ? "prompt.computerUse.stopAndExit" : "prompt.computerUse.exit"
}

export function computerUseMcpError(status: { status: string; error?: string } | undefined) {
  if (status?.status === "connected") return
  return `Cua Driver MCP ${status?.status ?? "is not configured"}${status?.error ? `: ${status.error}` : ""}`
}

export const ComputerUseStatus: Component<{
  active: boolean
  working: boolean
  pending: boolean
  onExit: () => void
  t: (key: string) => string
}> = (props) => (
  <Show when={props.active}>
    <div
      data-component="prompt-computer-use"
      class="mx-2 mt-2 flex items-center gap-2 rounded-md border border-border-weak-base bg-surface-info-base/20 px-2 py-1 text-12-regular text-text-strong"
    >
      <Icon name="status" size="small" class="shrink-0 text-icon-info-active" />
      <span class="min-w-0 flex-1 truncate">{props.t("prompt.computerUse.enabled")}</span>
      <button
        data-action="prompt-computer-use-exit"
        type="button"
        class="flex items-center gap-1 text-text-weak hover:text-text-strong disabled:opacity-50"
        disabled={props.pending}
        onClick={props.onExit}
      >
        <span>{props.t(computerUseExitLabel(props.working))}</span>
        <Icon name="close-small" size="small" />
      </button>
    </div>
  </Show>
)
