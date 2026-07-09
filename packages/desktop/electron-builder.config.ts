import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
const shouldSkipCodeSigning = process.env.NECODE_SKIP_CODE_SIGNING === "true"

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const APP_IDS = {
  dev: "ai.necode.desktop.dev",
  beta: "ai.necode.desktop.beta",
  prod: "ai.necode.desktop",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "necode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.necode.desktop" becomes
  // "ai.necode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: shouldSkipCodeSigning ? false : true,
    target: ["dmg"],
  },
  dmg: {
    sign: shouldSkipCodeSigning ? false : true,
  },
  protocols: {
    name: "NeCode",
    schemes: ["necode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: shouldSkipCodeSigning ? undefined : {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "NeCode Dev",
        deb: { packageName: "necode-dev" },
        rpm: { packageName: "necode-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "NeCode Beta",
        protocols: { name: "NeCode Beta", schemes: ["necode"] },
        deb: { packageName: "necode-beta" },
        rpm: { packageName: "necode-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "NeCode",
        protocols: { name: "NeCode", schemes: ["necode"] },
        deb: { packageName: "necode" },
        rpm: { packageName: "necode" },
      }
    }
  }
}

export default getConfig()
