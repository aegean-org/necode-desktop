import { expect, test } from "bun:test"
import { buildNeGatewayAuthorization } from "../../src/ne/gateway-auth"

test("NE gateway authorization prefixes plain tokens", () => {
  expect(buildNeGatewayAuthorization("abc")).toBe("Bearer necli##abc")
})

test("NE gateway authorization does not double-prefix scoped tokens", () => {
  expect(buildNeGatewayAuthorization("necli##abc")).toBe("Bearer necli##abc")
})
