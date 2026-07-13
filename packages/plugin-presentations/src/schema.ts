import { tool } from "@opencode-ai/plugin"

export type SlideLayout = "title" | "title-and-content" | "section" | "blank"
export type SlideInput = {
  layout?: SlideLayout
  title: string
  subtitle?: string
  bullets?: string[]
  notes?: string
}

/** Structured slide schema accepted by presentation create and revise. */
export const SlideInputSchema = tool.schema.object({
  layout: tool.schema.enum(["title", "title-and-content", "section", "blank"]).optional(),
  title: tool.schema.string(),
  subtitle: tool.schema.string().optional(),
  bullets: tool.schema.array(tool.schema.string()).optional(),
  notes: tool.schema.string().optional(),
})

/** Validates supported layouts and required slide text. */
export function validateSlides(slides: readonly SlideInput[]) {
  if (slides.length === 0) throw new Error("At least one slide is required")
  slides.forEach((slide, index) => {
    const layout = slide.layout ?? "title-and-content"
    if (!(["title", "title-and-content", "section", "blank"] as const).includes(layout)) {
      throw new Error(`Unsupported slide layout at ${index + 1}: ${layout}`)
    }
    if (layout !== "blank" && !slide.title.trim()) throw new Error(`Slide ${index + 1} title is required`)
    if (slide.bullets?.some((bullet) => !bullet.trim())) throw new Error(`Slide ${index + 1} contains an empty bullet`)
  })
}
