import { Button } from "@opencode-ai/ui/button"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { Show } from "solid-js"
import { useLanguage } from "@/context/language"

export type WorkflowSessionActionsProps = {
  readonly title: string
  readonly pinned: boolean
  readonly archived: boolean
  readonly onPin: () => void | Promise<void>
  readonly onUnpin: () => void | Promise<void>
  readonly onArchive: () => void | Promise<void>
  readonly onRestore: () => void | Promise<void>
  readonly onDelete: () => Promise<boolean>
  readonly onRename?: () => void
}

/** Renders reversible workflow actions and confirmed permanent deletion for a session row. */
export function WorkflowSessionActions(props: WorkflowSessionActionsProps) {
  const language = useLanguage()
  const dialog = useDialog()
  const togglePin = () => void (props.pinned ? props.onUnpin : props.onPin)()
  const toggleArchive = () => void (props.archived ? props.onRestore : props.onArchive)()

  return (
    <div class="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
      <IconButtonV2
        data-action="workflow-session-pin"
        variant={props.pinned ? "neutral" : "ghost-muted"}
        size="small"
        icon={<IconV2 name="pin" />}
        aria-label={language.t(props.pinned ? "session.action.unpin" : "session.action.pin")}
        title={language.t(props.pinned ? "session.action.unpin" : "session.action.pin")}
        data-selected={props.pinned ? "" : undefined}
        onClick={togglePin}
      />
      <MenuV2 gutter={4} placement="bottom-end">
        <MenuV2.Trigger
          as={IconButtonV2}
          data-action="workflow-session-menu"
          variant="ghost-muted"
          size="small"
          icon={<IconV2 name="outline-dots" />}
          aria-label={language.t("common.moreOptions")}
        />
        <MenuV2.Portal>
          <MenuV2.Content>
            <Show when={props.onRename}>
              <MenuV2.Item onSelect={() => props.onRename?.()}>{language.t("common.rename")}</MenuV2.Item>
            </Show>
            <MenuV2.Item onSelect={toggleArchive}>
              {language.t(props.archived ? "session.action.restore" : "common.archive")}
            </MenuV2.Item>
            <MenuV2.Separator />
            <MenuV2.Item
              onSelect={() => dialog.show(() => <DialogDeleteWorkflowSession title={props.title} onDelete={props.onDelete} />)}
            >
              {language.t("common.delete")}
            </MenuV2.Item>
          </MenuV2.Content>
        </MenuV2.Portal>
      </MenuV2>
    </div>
  )
}

function DialogDeleteWorkflowSession(props: { title: string; onDelete: () => Promise<boolean> }) {
  const language = useLanguage()
  const dialog = useDialog()
  const remove = async () => {
    if (await props.onDelete()) dialog.close()
  }

  return (
    <Dialog title={language.t("session.delete.title")} fit>
      <div class="flex flex-col gap-4 pl-6 pr-2.5 pb-3">
        <span class="text-14-regular text-text-strong">
          {language.t("session.delete.confirm", { name: props.title })}
        </span>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="large" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button variant="primary" size="large" onClick={() => void remove()}>
            {language.t("session.delete.button")}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
