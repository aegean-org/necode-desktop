import { expect, test } from "bun:test"

const sidebar = await Bun.file(new URL("./workflow-session-sidebar.tsx", import.meta.url)).text()
const session = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

test("keeps project creation on project rows and exposes a project menu", () => {
  expect(sidebar).not.toContain('data-action="session-project-new-session"')
  expect(sidebar).toContain('data-action="session-project-row-new-session"')
  expect(sidebar).toContain('data-action="session-project-row-menu"')
  expect(sidebar).toContain("project.action.openInExplorer")
  expect(sidebar).toContain("project.action.pin")
  expect(sidebar).not.toContain("sidebar.workspaces.enable")
  expect(sidebar).not.toContain("sidebar.workspaces.disable")
  expect(sidebar).not.toContain("onToggleProjectWorkspaces")
  expect(sidebar).not.toContain("projectWorkspacesEnabled")
  expect(sidebar).toContain("project.removeFromNecode")
  expect(session).toContain("onOpenProjectDirectory={openWorkflowProjectDirectory}")
  expect(session).toContain("onEditProject={editWorkflowProject}")
  expect(session).not.toContain("onToggleProjectWorkspaces")
  expect(session).not.toContain("projectWorkspacesEnabled")
})
