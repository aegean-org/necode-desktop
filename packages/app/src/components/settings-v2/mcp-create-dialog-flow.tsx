import { useDialog } from "@opencode-ai/ui/context/dialog"
import type { Accessor } from "solid-js"
import { DialogMcpAdd } from "./dialog-mcp-add"
import { DialogMcpImport } from "./dialog-mcp-import"
import { DialogMcp } from "./dialog-mcp"
import type { McpExistingEntry, McpForm, McpFormResult } from "./mcp-form"

type McpCreateDialogFlowProps = {
  existingEntries: Accessor<readonly McpExistingEntry[]>
  onSubmit: (result: McpFormResult) => Promise<void>
}

/** Owns the desktop MCP create-dialog transitions and final submission boundary. */
export function McpCreateDialogFlow(props: McpCreateDialogFlowProps) {
  const dialog = useDialog()
  return (
    <DialogMcpAdd
      onManual={() => replaceCreateDialog(dialog, props)}
      onImport={() =>
        dialog.replace(() => (
          <DialogMcpImport scope="project" onContinue={(form) => replaceCreateDialog(dialog, props, form)} />
        ))
      }
    />
  )
}

function replaceCreateDialog(dialog: ReturnType<typeof useDialog>, props: McpCreateDialogFlowProps, form?: McpForm) {
  return dialog.replace(() => (
    <DialogMcp initialForm={form} existingEntries={props.existingEntries()} onSubmit={props.onSubmit} />
  ))
}
