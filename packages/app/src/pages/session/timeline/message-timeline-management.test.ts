import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./message-timeline.tsx", import.meta.url)).text()

describe("MessageTimeline session management", () => {
  test("delegates archive and delete requests to the shared session management client", () => {
    const actions = source.slice(source.indexOf("const archiveSession"), source.indexOf("const navigateParent"))

    expect(source).toContain("createSessionManagement")
    expect(actions).toContain("sessionManagement().archive(sessionID)")
    expect(actions).toContain("sessionManagement().remove(sessionID)")
    expect(actions).not.toContain("client.session.update")
    expect(actions).not.toContain("client.session.delete")
  })

  test("keeps delete confirmation open when deletion fails", () => {
    expect(source).toContain("if (await deleteSession(props.sessionID)) dialog.close()")
  })

  test("returns the new workflow layout to its overview after removing the last session", () => {
    const navigation = source.slice(source.indexOf("const navigateAfterSessionRemoval"), source.indexOf("const archiveSession"))

    expect(navigation).toContain("settings.general.newLayoutDesigns()")
    expect(navigation).toContain('navigate("/")')
    expect(navigation.indexOf('navigate("/")')).toBeLessThan(navigation.indexOf("navigate(`/${params.dir}/session`)"))
  })
})
