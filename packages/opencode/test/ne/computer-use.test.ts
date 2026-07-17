import { describe, expect, test } from "bun:test"
import { ComputerUse } from "@/ne/computer-use"

describe("ComputerUse.detect", () => {
  test("prefers PATH before the official Windows install directory", async () => {
    const seen: string[][] = []
    const status = await ComputerUse.detect({
      platform: "win32",
      env: {
        PATH: "C:\\Tools;C:\\Other",
        LOCALAPPDATA: "C:\\Users\\hu\\AppData\\Local",
      },
      exists: async (path) =>
        [
          "C:\\Tools\\cua-driver.exe",
          "C:\\Users\\hu\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe",
        ].includes(path),
      run: async (command) => {
        seen.push(command)
        return { exitCode: 0, stdout: "cua-driver 0.8.1\n", stderr: "" }
      },
    })

    expect(status).toMatchObject({ status: "ready", path: "C:\\Tools\\cua-driver.exe", version: "0.8.1" })
    expect(seen).toEqual([["C:\\Tools\\cua-driver.exe", "--version"]])
  })

  test("finds the official Windows installer location when PATH does not contain the driver", async () => {
    const target = "C:\\Users\\hu\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe"
    const status = await ComputerUse.detect({
      platform: "win32",
      env: { PATH: "C:\\Tools", LOCALAPPDATA: "C:\\Users\\hu\\AppData\\Local" },
      exists: async (path) => path === target,
      run: version,
    })

    expect(status).toMatchObject({ status: "ready", path: target, version: "0.8.1" })
  })

  test("checks the documented macOS paths and reports missing permissions", async () => {
    const commands: string[][] = []
    const status = await ComputerUse.detect({
      platform: "darwin",
      home: "/Users/hu",
      env: { PATH: "/Applications/bin:/usr/bin" },
      exists: async (path) => path === "/Users/hu/.local/bin/cua-driver",
      run: async (command) => {
        commands.push(command)
        if (command.includes("--version")) return version()
        return {
          exitCode: 0,
          stdout: JSON.stringify({ accessibility: true, screen_recording: false }),
          stderr: "",
        }
      },
    })

    expect(status).toMatchObject({
      status: "needs_permissions",
      path: "/Users/hu/.local/bin/cua-driver",
      version: "0.8.1",
      permissions: { accessibility: true, screenRecording: false },
    })
    expect(commands).toEqual([
      ["/Users/hu/.local/bin/cua-driver", "--version"],
      ["/Users/hu/.local/bin/cua-driver", "permissions", "status", "--json"],
    ])
  })

  test("reports ready only when both macOS permissions are granted", async () => {
    const status = await ComputerUse.detect({
      platform: "darwin",
      home: "/Users/hu",
      env: {},
      exists: async (path) => path === "/opt/homebrew/bin/cua-driver",
      run: async (command) =>
        command.includes("--version")
          ? version()
          : {
              exitCode: 0,
              stdout: JSON.stringify({ accessibility: true, screen_recording: true }),
              stderr: "",
            },
    })

    expect(status).toMatchObject({ status: "ready", path: "/opt/homebrew/bin/cua-driver", version: "0.8.1" })
  })

  test("returns honest unsupported, not installed, and command failure states", async () => {
    expect((await ComputerUse.detect({ platform: "linux", env: {}, exists: async () => false })).status).toBe(
      "unsupported",
    )
    expect((await ComputerUse.detect({ platform: "win32", env: {}, exists: async () => false })).status).toBe(
      "not_installed",
    )

    const failed = await ComputerUse.detect({
      platform: "win32",
      env: { PATH: "C:\\Tools" },
      exists: async () => true,
      run: async () => ({ exitCode: 9, stdout: "", stderr: "broken driver" }),
    })
    expect(failed).toMatchObject({ status: "failed", exitCode: 9, error: "broken driver" })
  })
})

function version() {
  return Promise.resolve({ exitCode: 0, stdout: "cua-driver 0.8.1\n", stderr: "" })
}
