import type { PermissionActionConfig, PermissionConfig } from "@opencode-ai/sdk/v2/client"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { createMemo, For } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"
import { permissionToolSelection, setPermissionToolAction, type PermissionSelection } from "../permission-config"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import "./settings-v2.css"

type PermissionTool = (typeof PERMISSION_TOOLS)[number]
type ActionOption = { value: PermissionActionConfig; label: string }
type Translate = (key: string) => string

const PERMISSION_TOOLS = [
  "read",
  "edit",
  "glob",
  "grep",
  "list",
  "bash",
  "task",
  "skill",
  "lsp",
  "todowrite",
  "webfetch",
  "websearch",
  "external_directory",
  "doom_loop",
] as const

const PERMISSION_ACTIONS = ["allow", "ask", "deny"] as const

/**
 * Renders server-wide permission override controls for Settings v2.
 */
export function SettingsPermissionsV2() {
  const language = useLanguage()
  const serverSync = useServerSync()
  const [pending, setPending] = createStore<Record<string, boolean>>({})
  const options = createMemo<ActionOption[]>(() =>
    PERMISSION_ACTIONS.map((value) => ({ value, label: language.t(`settings.permissions.action.${value}`) })),
  )

  const updateTool = (tool: PermissionTool, action: PermissionActionConfig) => {
    const before = serverSync().data.config.permission
    if (permissionToolSelection(before, tool) === action) return
    const next = setPermissionToolAction(before, tool, action)
    setPending(tool, true)
    serverSync().set("config", "permission", next)
    void serverSync()
      .updateConfig({ permission: next })
      .catch((error: unknown) => {
        serverSync().set("config", "permission", before)
        console.error("[settings-permissions] update failed", error)
        showToast({
          variant: "error",
          title: language.t("settings.permissions.toast.updateFailed.title"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => setPending(tool, false))
  }

  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.permissions.title")}</h2>
      </div>
      <div class="settings-v2-tab-body settings-v2-permissions">
        <div class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("settings.permissions.section.tools")}</h3>
          <SettingsListV2>
            <For each={PERMISSION_TOOLS}>
              {(tool) => (
                <SettingsPermissionRow
                  actions={options()}
                  disabled={!!pending[tool]}
                  permission={serverSync().data.config.permission}
                  t={language.t}
                  tool={tool}
                  onSelect={(action) => updateTool(tool, action)}
                />
              )}
            </For>
          </SettingsListV2>
        </div>
      </div>
    </>
  )
}

function SettingsPermissionRow(props: {
  actions: ActionOption[]
  disabled: boolean
  permission: PermissionConfig | undefined
  t: Translate
  tool: PermissionTool
  onSelect: (action: PermissionActionConfig) => void
}) {
  const selection = () => permissionToolSelection(props.permission, props.tool)
  return (
    <SettingsRowV2
      title={props.t(`settings.permissions.tool.${props.tool}.title`)}
      description={props.t(`settings.permissions.tool.${props.tool}.description`)}
    >
      <SelectV2
        appearance="inline"
        disabled={props.disabled}
        options={props.actions}
        current={currentAction(props.actions, selection())}
        placeholder={placeholder(selection(), props.t)}
        placement="bottom-end"
        gutter={6}
        value={(option) => option.value}
        label={(option) => option.label}
        onSelect={(option) => option && props.onSelect(option.value)}
      />
    </SettingsRowV2>
  )
}

function currentAction(actions: ActionOption[], selection: PermissionSelection) {
  return actions.find((option) => option.value === selection)
}

function placeholder(selection: PermissionSelection, t: Translate) {
  if (selection === "custom") return t("settings.permissions.action.custom")
  return t("settings.permissions.action.unset")
}
