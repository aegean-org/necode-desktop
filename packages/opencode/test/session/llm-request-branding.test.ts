import { expect, test } from "bun:test"
import { Effect } from "effect"
import { LLMRequestPrep } from "@/session/llm/request"

const model = {
  id: "anthropic/claude-3-5-sonnet",
  providerID: "anthropic",
  api: {
    id: "claude-3-5-sonnet-20241022",
    url: "https://api.anthropic.com",
    npm: "@ai-sdk/anthropic",
  },
  name: "Claude 3.5 Sonnet",
  capabilities: {
    temperature: true,
    reasoning: false,
    attachment: true,
    toolcall: true,
    input: { text: true, audio: false, image: true, video: false, pdf: true },
    output: { text: true, audio: false, image: false, video: false, pdf: false },
    interleaved: false,
  },
  cost: {
    input: 0.003,
    output: 0.015,
    cache: { read: 0.0003, write: 0.00375 },
  },
  limit: { context: 200000, output: 8192 },
  status: "active",
  options: {},
  headers: {},
} as any

test("adds NeCode naming guidance even when an agent supplies a custom prompt", async () => {
  const result = await Effect.runPromise(
    LLMRequestPrep.prepare({
      user: {
        id: "msg_user-branding",
        sessionID: "ses_branding",
        role: "user",
        time: { created: Date.now() },
        agent: "test",
        model: { providerID: "anthropic", modelID: model.api.id },
      } as any,
      sessionID: "ses_branding",
      model,
      agent: {
        name: "test",
        mode: "primary",
        prompt: "Custom agent prompt.",
        options: {},
        permission: [],
      } as any,
      system: [],
      messages: [{ role: "user", content: "Hello" }],
      tools: {},
      provider: { id: "anthropic", options: {} } as any,
      auth: undefined,
      plugin: {
        trigger: (_name: string, _input: unknown, output: unknown) => Effect.succeed(output),
        list: () => Effect.succeed([]),
        init: () => Effect.void,
      } as any,
      flags: { outputTokenMax: 32_000, client: "test" } as any,
      isWorkflow: false,
    }),
  )

  expect(result.system[0]).toContain('Call the product "NeCode" in user-facing responses.')
  expect(result.system[0]).toContain("Preserve technical identifiers such as `opencode.json`")
})
