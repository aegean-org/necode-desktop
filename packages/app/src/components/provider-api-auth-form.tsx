import type { ProviderAuthMethod } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { TextField } from "@opencode-ai/ui/text-field"
import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"

/**
 * Renders provider-owned API auth prompts without treating them as raw API keys.
 */
export function ProviderApiAuthForm(props: {
  method: ProviderAuthMethod | undefined
  submitLabel: string
  pending?: boolean
  onSubmit: (inputs: Record<string, string>) => Promise<void>
}) {
  const [store, setStore] = createStore({ value: {} as Record<string, string> })
  const prompts = createMemo(() => (props.method?.type === "api" ? (props.method.prompts ?? []) : []))
  const textPrompts = createMemo(() => prompts().filter((prompt) => prompt.type === "text"))
  const valid = createMemo(() => textPrompts().every((prompt) => (store.value[prompt.key] ?? "").trim() !== ""))

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid() || props.pending) return
    await props.onSubmit({ ...store.value })
  }

  return (
    <form onSubmit={handleSubmit} class="flex w-full flex-col items-start gap-4">
      {textPrompts().map((prompt, index) => (
        <TextField
          autofocus={index === 0}
          type={prompt.key.toLowerCase().includes("password") ? "password" : "text"}
          label={prompt.message}
          placeholder={prompt.placeholder}
          value={store.value[prompt.key] ?? ""}
          onChange={(value) => setStore("value", prompt.key, value)}
        />
      ))}
      <Button class="w-auto" type="submit" size="large" variant="primary" disabled={!valid() || props.pending}>
        {props.submitLabel}
      </Button>
    </form>
  )
}
