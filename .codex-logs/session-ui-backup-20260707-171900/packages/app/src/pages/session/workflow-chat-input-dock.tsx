import { type JSX } from "solid-js"

/** Dock that makes the existing composer belong to the workflow content panel. */
export function WorkflowChatInputDock(props: { children: JSX.Element; class?: string }) {
  return (
    <div
      data-component="workflow-chat-input-dock"
      class={`shrink-0 bg-[var(--workflow-panel-content)] px-4 pb-4 pt-2 ${props.class ?? ""}`}
    >
      {props.children}
    </div>
  )
}
