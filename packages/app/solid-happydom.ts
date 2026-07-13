import solid from "vite-plugin-solid"
import "./happydom"

const transformer = solid({ dev: false })

Bun.plugin({
  name: "solid-test-transform",
  setup(build) {
    build.onLoad({ filter: /\.tsx$/ }, async (args) => {
      const result = await transformer.transform?.(await Bun.file(args.path).text(), args.path, { ssr: false })
      if (!result || typeof result === "string") throw new Error(`Solid test transform failed: ${args.path}`)
      return { contents: result.code, loader: "ts" }
    })
  },
})
