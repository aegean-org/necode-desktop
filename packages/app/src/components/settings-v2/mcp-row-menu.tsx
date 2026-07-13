import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { McpManagementRow } from "./mcp-model"

/** Management actions for one writable persistent MCP entry. */
export function McpRowMenu(props: {
  entry: McpManagementRow
  onEdit: (entry: McpManagementRow) => void
  onRemove: (entry: McpManagementRow) => void
}) {
  const language = useLanguage()
  return (
    <Show when={props.entry.canManage}>
      <MenuV2 gutter={4} modal={false} placement="bottom-end">
        <MenuV2.Trigger
          as={IconButtonV2}
          variant="ghost-muted"
          size="small"
          icon={<IconV2 name="outline-dots" />}
          aria-label={language.t("common.moreOptions")}
        />
        <MenuV2.Portal>
          <MenuV2.Content>
            <MenuV2.Item onSelect={() => props.onEdit(props.entry)}>
              {language.t("settings.mcp.action.edit")}
            </MenuV2.Item>
            <MenuV2.Separator />
            <MenuV2.Item onSelect={() => props.onRemove(props.entry)}>
              {language.t("settings.mcp.action.remove")}
            </MenuV2.Item>
          </MenuV2.Content>
        </MenuV2.Portal>
      </MenuV2>
    </Show>
  )
}
