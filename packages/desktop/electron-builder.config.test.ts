import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

const channels = [
  {
    channel: "dev",
    appId: "ai.necode.desktop.dev",
    productName: "NeCode Dev",
    protocolName: "NeCode",
    packageName: "necode-dev",
  },
  {
    channel: "beta",
    appId: "ai.necode.desktop.beta",
    productName: "NeCode Beta",
    protocolName: "NeCode Beta",
    packageName: "necode-beta",
  },
  {
    channel: "prod",
    appId: "ai.necode.desktop",
    productName: "NeCode",
    protocolName: "NeCode",
    packageName: "necode",
  },
] as const

for (const channel of channels) {
  test(`uses one desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.OPENCODE_CHANNEL
    process.env.OPENCODE_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.productName).toBe(channel.productName)
    expect(config.protocols).toEqual({ name: channel.protocolName, schemes: ["necode"] })
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
    expect(config.deb?.packageName).toBe(channel.packageName)
    expect(config.rpm?.packageName).toBe(channel.packageName)
    expect(config.publish).toBeUndefined()
  })
}
