import { Splash } from "@opencode-ai/ui/logo"

const bars = ["w-24", "w-32", "w-20", "w-28"]

export function StartupSplash() {
  return (
    <div class="h-dvh w-screen overflow-hidden bg-v2-background-bg-deep p-1.5">
      <div class="flex size-full gap-1.5">
        <div class="hidden w-[220px] shrink-0 flex-col px-3 py-4 md:flex">
          <div class="h-5 w-16 rounded bg-v2-background-bg-layer-02" />
          <div class="mt-5 flex flex-col gap-3">
            {bars.map((width) => (
              <div class={`h-3 ${width} rounded-full bg-v2-background-bg-layer-02`} />
            ))}
          </div>
        </div>

        <div class="hidden w-[300px] shrink-0 overflow-hidden rounded-[10px] bg-v2-background-bg-layer-01 shadow-[var(--v2-elevation-raised)] md:block">
          <div class="flex h-12 items-center px-4">
            <div class="h-4 w-20 rounded bg-v2-background-bg-layer-02" />
          </div>
          <div class="flex flex-col gap-2 px-2">
            {[0, 1, 2, 3].map((index) => (
              <div class="rounded-[8px] bg-v2-background-bg-layer-02 px-3 py-3" style={{ opacity: 0.7 - index * 0.1 }}>
                <div class="h-3 w-3/4 rounded-full bg-v2-background-bg-layer-03" />
                <div class="mt-2 h-2.5 w-2/5 rounded-full bg-v2-background-bg-layer-03" />
              </div>
            ))}
          </div>
        </div>

        <div class="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[10px] bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]">
          <div class="absolute inset-x-0 top-0 flex h-12 items-center border-b border-v2-border-border-muted px-5">
            <div class="h-4 w-40 rounded-full bg-v2-background-bg-layer-02" />
          </div>
          <div class="flex flex-col items-center gap-4">
            <div class="flex size-14 items-center justify-center rounded-[14px] bg-v2-background-bg-layer-01 shadow-[var(--v2-elevation-floating)]">
              <Splash class="h-9 w-9" />
            </div>
            <div class="h-1 w-20 overflow-hidden rounded-full bg-v2-background-bg-layer-02">
              <div class="h-full w-1/2 animate-pulse rounded-full bg-v2-icon-icon-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
