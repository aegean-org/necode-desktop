import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"
import { fixture, pageMessages } from "./session-timeline.fixture"

const neProviderID = "ne"
const provider = { ...fixture.provider, connected: [neProviderID, ...fixture.provider.connected] }

test("workflow shell renders Home and Session detail panel roles", async ({ page }) => {
  await mockOpenCodeServer(page, {
    sessions: fixture.sessions,
    provider,
    directory: fixture.directory,
    project: fixture.project,
    pageMessages,
  })
  await configureWorkflowShellSmokePage(page, fixture.directory)

  await page.goto("/")
  await expectWorkflowShellPanels(page)

  await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
  await expectWorkflowShellPanels(page)
  await expectWorkflowSurfaces(page)
})

async function configureWorkflowShellSmokePage(page: Page, directory: string) {
  await page.addInitScript((directory) => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem(
      "opencode.global.dat:server",
      JSON.stringify({
        projects: { local: [{ worktree: directory, expanded: true }] },
        lastProject: { local: directory },
      }),
    )
  }, directory)
}

async function expectWorkflowShellPanels(page: Page) {
  await expect(page.locator('[data-component="workflow-shell"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="sidebar"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="navigator"]')).toBeVisible()
  await expect(page.locator('[data-panel-role="content"]')).toBeVisible()
}

async function expectWorkflowSurfaces(page: Page) {
  const surfaces = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        background: style.backgroundColor,
        boxShadow: style.boxShadow,
        width: Math.round(rect.width),
      }
    }

    return {
      shell: read('[data-component="workflow-shell"]'),
      sidebar: read('[data-panel-role="sidebar"]'),
      navigator: read('[data-panel-role="navigator"]'),
      content: read('[data-panel-role="content"]'),
    }
  })

  expect(surfaces.shell).not.toBeNull()
  expect(surfaces.sidebar?.boxShadow).toBe("none")
  expect(surfaces.navigator?.boxShadow).not.toBe("none")
  expect(surfaces.content?.boxShadow).not.toBe("none")
  expect(surfaces.content?.width).toBeGreaterThanOrEqual(440)
}
