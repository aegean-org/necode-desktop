import { Select } from "@opencode-ai/ui/select"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { Show, createMemo, createSignal, type JSX } from "solid-js"
import { usePlatform } from "@/context/platform"
import {
  fontLoadErrorMessage,
  fontOptionsFor,
  loadAvailableFontFamilies,
  type FontOption,
} from "./settings-font-options"

type FontSelectProps = {
  "data-action": string
  title: string
  defaultLabel: string
  value: string
  fontFamily: string
  onSelect(value: string): void
}

let localFontFamilies: readonly string[] | undefined
let localFontFamiliesPending: Promise<readonly string[]> | undefined

/** Legacy settings font selector backed by local font enumeration. */
export function SettingsFontSelect(props: FontSelectProps) {
  const state = useFontSelectState(props)
  return (
    <>
      <Select
        data-action={props["data-action"]}
        options={state.options()}
        current={state.current()}
        value={(option) => option.id}
        label={(option) => option.label}
        onOpenChange={(open) => open && void state.load()}
        onSelect={(option) => option && props.onSelect(option.value)}
        variant="secondary"
        size="small"
        triggerVariant="settings"
        triggerStyle={{ "min-width": "220px", "font-family": props.fontFamily }}
        triggerProps={{ "aria-label": props.title }}
      >
        {fontOptionLabel}
      </Select>
      <FontLoadError message={state.error()} />
    </>
  )
}

/** V2 settings font selector backed by local font enumeration. */
export function SettingsFontSelectV2(props: FontSelectProps) {
  const state = useFontSelectState(props)
  return (
    <>
      <SelectV2
        appearance="base"
        data-action={props["data-action"]}
        class="settings-v2-font-select"
        options={state.options()}
        current={state.current()}
        value={(option) => option.id}
        label={(option) => option.label}
        onOpenChange={(open) => open && void state.load()}
        onSelect={(option) => option && props.onSelect(option.value)}
        aria-label={props.title}
        style={{ "font-family": props.fontFamily }}
      >
        {fontOptionLabel}
      </SelectV2>
      <FontLoadError message={state.error()} />
    </>
  )
}

function useFontSelectState(props: FontSelectProps) {
  const platform = usePlatform()
  const [families, setFamilies] = createSignal(localFontFamilies ?? [])
  const [error, setError] = createSignal("")
  const options = createMemo(() => {
    return fontOptionsFor({ available: families(), current: props.value, defaultLabel: props.defaultLabel })
  })
  const current = createMemo(() => {
    return options().find((option) => option.value.toLowerCase() === props.value.trim().toLowerCase()) ?? options()[0]
  })
  const load = async () => {
    if (localFontFamilies) return
    try {
      setError("")
      localFontFamiliesPending ??= loadAvailableFontFamilies(platform)
      localFontFamilies = await localFontFamiliesPending
      setFamilies(localFontFamilies)
    } catch (err) {
      setError(fontLoadErrorMessage(err))
      localFontFamiliesPending = undefined
    }
  }
  return { options, current, error, load }
}

function fontOptionLabel(option: FontOption | undefined): JSX.Element {
  if (!option) return null
  return <span style={{ "font-family": option.value || undefined }}>{option.label}</span>
}

function FontLoadError(props: { message: string }) {
  return (
    <Show when={props.message}>
      <div
        style={{
          "margin-top": "4px",
          "max-width": "220px",
          "font-size": "11px",
          "line-height": "14px",
          color: "var(--v2-state-fg-danger, #c0362c)",
        }}
      >
        {props.message}
      </div>
    </Show>
  )
}
