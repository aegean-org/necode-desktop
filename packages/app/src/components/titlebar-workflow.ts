/**
 * V2 workflow navigation uses persistent columns instead of titlebar session tabs.
 */
export function shouldUseTitlebarSessionTabs(input: { workflowLayout: boolean }) {
  return !input.workflowLayout
}

