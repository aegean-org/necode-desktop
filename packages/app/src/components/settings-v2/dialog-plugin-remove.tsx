import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import "./plugin.css"

/** Confirms removal of one external plugin configuration. */
export function DialogPluginRemove(props: { entry: PluginEntry; onConfirm: () => Promise<void> }) {
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
  return (
    <Dialog title={language.t("settings.plugins.dialog.remove.title")} fit class="settings-v2-plugin-remove-dialog">
      <div class="settings-v2-plugin-remove-copy">
        {language.t("settings.plugins.dialog.remove.description", {
          name: props.entry.name,
          scope: language.t(`settings.plugins.scope.${props.entry.scope}`),
        })}
      </div>
      <DialogFooter>
        <ButtonV2 type="button" variant="neutral" disabled={state.pending} onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 type="button" variant="contrast" disabled={state.pending} onClick={() => void confirm()}>
          {language.t("settings.plugins.dialog.remove.action")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
