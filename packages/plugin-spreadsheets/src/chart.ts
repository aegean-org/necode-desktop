const CHART = { width: 800, height: 480, padding: 64, titleY: 34, labelY: 442 } as const
const COLORS = ["#4f46e5", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#9333ea"] as const

export type ChartInput = {
  type: "bar" | "line" | "pie"
  title: string
  labels: string[]
  values: number[]
  range: string
}

/** Renders a deterministic chart SVG to an embedded PNG image. */
export async function renderChart(input: ChartInput) {
  validateChart(input)
  const sharp = (await import("sharp")).default
  return sharp(Buffer.from(chartSvg(input)))
    .png()
    .toBuffer()
}

/** Validates chart data and its worksheet image anchor. */
export function validateChart(input: ChartInput) {
  if (!input.title.trim()) throw new Error("Chart title is required")
  if (input.labels.length === 0) throw new Error("Chart data is required")
  if (input.labels.length !== input.values.length) throw new Error("Chart labels and values must have the same length")
  if (input.values.some((value) => !Number.isFinite(value))) throw new Error("Chart values must be finite numbers")
  if (!/^[A-Z]{1,3}[1-9]\d*:[A-Z]{1,3}[1-9]\d*$/i.test(input.range))
    throw new Error(`Invalid chart range: ${input.range}`)
}

function chartSvg(input: ChartInput) {
  const body = input.type === "bar" ? barSvg(input) : input.type === "line" ? lineSvg(input) : pieSvg(input)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART.width}" height="${CHART.height}" viewBox="0 0 ${CHART.width} ${CHART.height}"><rect width="100%" height="100%" fill="#ffffff"/><text x="${CHART.width / 2}" y="${CHART.titleY}" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#111827">${escapeXml(input.title)}</text>${body}</svg>`
}

function barSvg(input: ChartInput) {
  const width = CHART.width - CHART.padding * 2
  const height = CHART.height - CHART.padding * 2
  const max = Math.max(...input.values.map(Math.abs), 1)
  const slot = width / input.values.length
  return input.values
    .map((value, index) => {
      const barHeight = (Math.abs(value) / max) * height
      const x = CHART.padding + slot * index + slot * 0.2
      const y = CHART.height - CHART.padding - barHeight
      return `<rect x="${x}" y="${y}" width="${slot * 0.6}" height="${barHeight}" fill="${COLORS[index % COLORS.length]}"/><text x="${CHART.padding + slot * (index + 0.5)}" y="${CHART.labelY}" text-anchor="middle" font-family="sans-serif" font-size="16">${escapeXml(input.labels[index] ?? "")}</text>`
    })
    .join("")
}

function lineSvg(input: ChartInput) {
  const width = CHART.width - CHART.padding * 2
  const height = CHART.height - CHART.padding * 2
  const max = Math.max(...input.values.map(Math.abs), 1)
  const step = input.values.length === 1 ? 0 : width / (input.values.length - 1)
  const points = input.values.map(
    (value, index) =>
      `${CHART.padding + step * index},${CHART.height - CHART.padding - (Math.abs(value) / max) * height}`,
  )
  const labels = input.labels
    .map(
      (label, index) =>
        `<text x="${CHART.padding + step * index}" y="${CHART.labelY}" text-anchor="middle" font-family="sans-serif" font-size="16">${escapeXml(label)}</text>`,
    )
    .join("")
  return `<polyline points="${points.join(" ")}" fill="none" stroke="${COLORS[0]}" stroke-width="4"/>${points.map((point) => `<circle cx="${point.split(",")[0]}" cy="${point.split(",")[1]}" r="6" fill="${COLORS[0]}"/>`).join("")}${labels}`
}

function pieSvg(input: ChartInput) {
  const total = input.values.reduce((sum, value) => sum + Math.max(value, 0), 0)
  if (total <= 0) throw new Error("Pie chart values must contain a positive number")
  let angle = -Math.PI / 2
  return input.values
    .map((value, index) => {
      const next = angle + (Math.max(value, 0) / total) * Math.PI * 2
      const path = pieSlice(280, 250, 150, angle, next)
      angle = next
      return `<path d="${path}" fill="${COLORS[index % COLORS.length]}"/><text x="500" y="${100 + index * 28}" font-family="sans-serif" font-size="16">${escapeXml(input.labels[index] ?? "")}</text>`
    })
    .join("")
}

function pieSlice(cx: number, cy: number, radius: number, start: number, end: number) {
  const startPoint = { x: cx + radius * Math.cos(start), y: cy + radius * Math.sin(start) }
  const endPoint = { x: cx + radius * Math.cos(end), y: cy + radius * Math.sin(end) }
  const large = end - start > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${large} 1 ${endPoint.x} ${endPoint.y} Z`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
