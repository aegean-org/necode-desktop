import { type JSX } from "solid-js"

/** Dock that makes the existing composer belong to the workflow content panel. */
export function WorkflowChatInputDock(props: { children: JSX.Element; class?: string }) {
  return (
    <div
      data-component="workflow-chat-input-dock"
      class={`relative shrink-0 bg-[var(--workflow-panel-content)] px-5 pb-5 pt-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-[linear-gradient(to_bottom,transparent,var(--workflow-panel-content))] ${props.class ?? ""}`}
    >
      {props.children}
    </div>
  )
}
