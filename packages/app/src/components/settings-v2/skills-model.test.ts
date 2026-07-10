import { describe, expect, test } from "bun:test"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { filterSettingsSkills, loadSettingsSkills } from "./skills-model"

describe("settings skills model", () => {
  test("loads skills from the active session runtime registry", async () => {
    let requestUrl: URL | undefined
    const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      requestUrl = new URL(request.url)
      return Response.json([
        {
          name: "using-superpowers",
          description: "Use before starting work.",
          location: "/config/node_modules/superpowers/skills/using-superpowers/SKILL.md",
          content: "# Using Superpowers",
        },
      ])
    }) as typeof fetch
    const client = createOpencodeClient({
      baseUrl: "http://localhost",
      fetch: transport,
    })

    const skills = await loadSettingsSkills("D:/project/qt-static", client)

    expect(requestUrl?.pathname).toBe("/skill")
    expect(requestUrl?.searchParams.get("directory")).toBe("D:/project/qt-static")
    expect(skills.map((skill) => skill.name)).toEqual(["using-superpowers"])
  })

  test("uses direct text matching for the settings search", () => {
    const skills = [
      {
        name: "customize-necode",
        description: "Use ONLY when editing NeCode configuration.",
        location: "/builtin/customize-necode.md",
      },
      {
        name: "development-docs",
        description: "Project development handbook.",
        location: "/repo/docs/SKILL.md",
      },
    ]

    expect(filterSettingsSkills(skills, "dev").map((item) => item.name)).toEqual(["development-docs"])
  })

  test("searches name description and location", () => {
    const skills = [
      { name: "deploy", description: "Release helper.", location: "/repo/skills/deploy/SKILL.md" },
      { name: "docs", description: "Documentation helper.", location: "/repo/reference/SKILL.md" },
    ]

    expect(filterSettingsSkills(skills, "release").map((item) => item.name)).toEqual(["deploy"])
    expect(filterSettingsSkills(skills, "reference").map((item) => item.name)).toEqual(["docs"])
  })
})
