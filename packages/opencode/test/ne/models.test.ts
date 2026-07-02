import { expect, test } from "bun:test"
import { NE_GATEWAY_BASE_URL, NE_PROVIDER_ID } from "../../src/ne/constants"
import { createNeModels } from "../../src/ne/models"

test("createNeModels converts gateway chat models and filters non-chat entries", () => {
  const models = createNeModels({
    data: {
      models: [
        { id: "chat-a", name: "Chat A", type: "chat" },
        { id: "bge-m3", name: "BGE M3", type: "chat" },
        { id: "embed-a", name: "Embed A", model_type: "embedding" },
        { id: "asr-a", name: "Chat-looking ASR", type: "chat" },
        { id: "audio-a", name: "Audio ASR", type: "chat" },
        { id: "speech-a", name: "Speech A", task: "asr" },
        "asr-string",
      ],
    },
  })

  expect(Object.keys(models)).toEqual(["chat-a"])
  expect(models["chat-a"]).toMatchObject({
    id: "chat-a",
    providerID: NE_PROVIDER_ID,
    name: "Chat A",
    api: {
      npm: "@ai-sdk/openai-compatible",
      url: NE_GATEWAY_BASE_URL,
    },
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: {
        text: true,
        image: true,
      },
      output: {
        text: true,
      },
    },
    headers: {},
    options: {},
    limit: {
      context: 128000,
      output: 16384,
    },
  })
})

test("createNeModels treats gateway model-list entries as image-capable by default", () => {
  const models = createNeModels({
    data: [{ id: "qwen3.5", object: "model", created: 1779391793, owned_by: "configured" }],
  })

  expect(models["qwen3.5"].capabilities.attachment).toBe(true)
  expect(models["qwen3.5"].capabilities.input.image).toBe(true)
})
