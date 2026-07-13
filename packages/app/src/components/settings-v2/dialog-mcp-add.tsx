import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog } from "@opencode-ai/ui/v2/dialog-v2"
import { useLanguage } from "@/context/language"
import "./settings-v2.css"

/** Lets users choose how to prepare a new MCP configuration. */
export function DialogMcpAdd(props: { onManual: () => void; onImport: () => void }) {
  const language = useLanguage()
  return (
    <Dialog title={language.t("settings.mcp.addMethod.title")} fit>
      <div class="settings-v2-mcp-add-methods">
        <ButtonV2 type="button" onClick={props.onImport}>
          {language.t("settings.mcp.addMethod.import")}
        </ButtonV2>
        <ButtonV2 type="button" onClick={props.onManual}>
          {language.t("settings.mcp.addMethod.manual")}
        </ButtonV2>
      </div>
    </Dialog>
  )
}
