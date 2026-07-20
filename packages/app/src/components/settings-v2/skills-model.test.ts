import { describe, expect, test } from "bun:test"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import {
  changedSettingsSkills,
  filterSettingsSkills,
  installSettingsSkill,
  loadSettingsSkills,
  removeSettingsSkill,
  SettingsSkillConflict,
} from "./skills-model"

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

  test("identifies newly installed skills and managed overrides", () => {
    const plugin = {
      name: "shared-skill",
      description: "Plugin skill.",
      location: "/plugins/shared-skill/SKILL.md",
      content: "Plugin",
      source: "plugin" as const,
      scope: "plugin" as const,
      canUninstall: false,
    }
    const managed = {
      ...plugin,
      description: "Managed skill.",
      location: "/project/.opencode/skills/shared-skill/SKILL.md",
      content: "Managed",
      source: "managed" as const,
      scope: "local" as const,
      canUninstall: true,
      installSource: "git:https://github.com/example/skills.git#:",
    }
    const added = {
      ...managed,
      name: "new-skill",
      location: "/project/.opencode/skills/new-skill/SKILL.md",
    }

    expect(changedSettingsSkills([plugin], [managed, added]).map((item) => item.name)).toEqual([
      "new-skill",
      "shared-skill",
    ])
    expect(changedSettingsSkills([managed, added], [managed, added])).toEqual([])
  })

  test("installs and removes skills through the generated runtime API", async () => {
    const requests: Request[] = []
    const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      requests.push(request)
      return Response.json([])
    }) as typeof fetch
    const client = createOpencodeClient({ baseUrl: "http://localhost", fetch: transport })

    await installSettingsSkill("D:/project/demo", client, {
      source: "D:/skills/review",
      scope: "local",
      replace: false,
    })
    await removeSettingsSkill("D:/project/demo", client, "review")

    expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ["POST", "/skill"],
      ["DELETE", "/skill/review"],
    ])
    expect(await requests[0].json()).toEqual({ source: "D:/skills/review", scope: "local", replace: false })
  })

  test("exposes cross-source conflicts for explicit replacement confirmation", async () => {
    const transport = (async () =>
      Response.json(
        {
          _tag: "SkillManagedConflictError",
          message: "conflict",
          name: "review",
          currentSource: "one",
          incomingSource: "two",
        },
        { status: 409 },
      )) as unknown as typeof fetch
    const client = createOpencodeClient({ baseUrl: "http://localhost", fetch: transport })

    const error = await installSettingsSkill("D:/project/demo", client, {
      source: "two",
      scope: "local",
      replace: false,
    }).catch((cause) => cause)

    expect(error).toBeInstanceOf(SettingsSkillConflict)
    expect(error).toMatchObject({ skill: "review", currentSource: "one", incomingSource: "two" })
  })
})
