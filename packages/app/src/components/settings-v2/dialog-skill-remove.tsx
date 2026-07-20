import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog, DialogFooter } from "@opencode-ai/ui/v2/dialog-v2"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { SettingsSkillInfo } from "./skills-model"

/** Confirms removal of one independently installed managed Skill. */
export function DialogSkillRemove(props: { item: SettingsSkillInfo; onConfirm: () => Promise<void> }) {
  const dialog = useDialog()
  const language = useLanguage()
  const [state, setState] = createStore({ pending: false, error: "" })
  const confirm = async () => {
    if (state.pending) return
    setState({ pending: true, error: "" })
    try {
      await props.onConfirm()
      dialog.close()
    } catch (error) {
      setState("error", error instanceof Error ? error.message : String(error))
    } finally {
      setState("pending", false)
    }
  }
  return (
    <Dialog title={language.t("settings.skills.dialog.remove.title")} fit class="settings-v2-skill-remove-dialog">
      <div class="settings-v2-skill-remove-copy">
        {language.t("settings.skills.dialog.remove.description", { name: props.item.name })}
      </div>
      {state.error ? <div class="settings-v2-skill-error">{state.error}</div> : null}
      <DialogFooter>
        <ButtonV2 type="button" variant="neutral" disabled={state.pending} onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 type="button" variant="contrast" disabled={state.pending} onClick={() => void confirm()}>
          {language.t("settings.skills.action.remove")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
