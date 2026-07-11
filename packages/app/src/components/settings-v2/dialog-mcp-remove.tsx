import type { McpConfigEntry } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import "./settings-v2.css"

/** Confirms removal of one writable persistent MCP configuration. */
export function DialogMcpRemove(props: { entry: McpConfigEntry; onConfirm: () => Promise<void> }) {
  const dialog = useDialog()
  const language = useLanguage()
  const [state, setState] = createStore({ pending: false })
  const confirm = async () => {
    if (state.pending) return
    setState("pending", true)
    try {
      await props.onConfirm()
      dialog.close()
    } finally {
      setState("pending", false)
    }
  }
  const scope = () => language.t(`settings.mcp.dialog.scope.${props.entry.scope}`)
  return (
    <Dialog title={language.t("settings.mcp.dialog.remove.title")} fit class="settings-v2-mcp-remove-dialog">
      <div class="settings-v2-mcp-remove-copy">
        {language.t("settings.mcp.dialog.remove.description", { name: props.entry.name, scope: scope() })}
      </div>
      <DialogFooter>
        <ButtonV2 type="button" variant="neutral" disabled={state.pending} onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2
          type="button"
          variant="contrast"
          data-action="mcp-remove-confirm"
          disabled={state.pending}
          onClick={() => void confirm()}
        >
          {language.t("settings.mcp.dialog.remove.action")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
