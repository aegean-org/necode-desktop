import { describe, expect, test } from "bun:test"
import { MAX_ATTACHMENT_BYTES } from "./attachment-picker"
import { describePickedFilePaths } from "./picked-file-paths"

describe("describePickedFilePaths", () => {
  test("returns path metadata without applying the attachment read budget", async () => {
    const size = MAX_ATTACHMENT_BYTES + 1
    const files = await describePickedFilePaths(["/tmp/large.pdf"], async () => ({ size }))

    expect(files).toEqual([{ path: "/tmp/large.pdf", name: "large.pdf", size }])
  })
})
