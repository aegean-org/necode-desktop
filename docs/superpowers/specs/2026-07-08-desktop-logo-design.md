# Desktop Logo Replacement Design

## Goal

Replace the remaining OpenCode visual mark in the desktop product with the NeCode mark used by the iOS app at `D:\project\litter\apps\ios`.

## Scope

- Desktop package icons for `dev`, `beta`, and `prod` channels.
- Electron runtime window, taskbar, dock, installer, and Linux icon resources.
- Renderer favicon assets copied from `packages/app/public`.
- In-app logo components used by startup, login gate, home, and empty-session views.

Out of scope:

- Docs, web, console, and marketing assets.
- Product names, links, provider names, and package versioning.
- Any layout or workflow changes.

## Source Assets

- System app icon source: `D:\project\litter\apps\ios\Sources\Litter\Assets.xcassets\AppIcon.appiconset\Icon-1024.png`.
- In-app brand mark source: `D:\project\litter\apps\ios\Sources\Litter\Resources\brand_logo.png` and `brand_logo.svg`.

## Desktop Icon Pipeline

`packages/desktop/scripts/prebuild.ts` resolves the current channel and runs `scripts/copy-icons.ts`, which copies `packages/desktop/icons/<channel>` to `packages/desktop/resources/icons`. `electron-builder.config.ts` then references `resources/icons/icon.ico`, `resources/icons/icon.icns`, and the Linux icon directory.

The source of truth must remain `packages/desktop/icons/<channel>`, not `resources/icons`.

## Implementation Design

1. Generate channel icon files from the iOS system icon:
   - `icon.png`
   - `dock.png`
   - `icon.ico`
   - `icon.icns`
   - `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`
   - Windows Store-sized `StoreLogo.png` and `Square*Logo.png`
   - iOS and Android nested icon folders already carried by the desktop icon set
2. Apply the same NeCode icon to `dev`, `beta`, and `prod` so local development and packaged production match.
3. Replace `Mark`, `Splash`, and `Logo` in `packages/ui/src/components/logo.tsx` with NeCode-style marks.
4. Populate renderer favicon files in `packages/app/public` so Electron HTML references no longer point to empty files.

## Verification

- Confirm generated image dimensions match the target filenames.
- Run focused tests for icon HTML and product entry points where relevant.
- Run `bun typecheck` in `packages/ui`, `packages/app`, and `packages/desktop` if the logo component code changes.
- Run `bun run build` and `bun run package:win:dir` in `packages/desktop`.
- Inspect the packaged output to confirm `resources/icons/icon.ico` and renderer favicon assets are present and non-empty.

