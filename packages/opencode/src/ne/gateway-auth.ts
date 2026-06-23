import { NE_GATEWAY_APP_SOURCE } from "./constants"

export function buildNeGatewayBearerValue(token: string) {
  const value = token.trim().replace(/^Bearer\s+/i, "")
  if (value.includes("##")) return value
  return `${NE_GATEWAY_APP_SOURCE}##${value}`
}

export function buildNeGatewayAuthorization(token: string) {
  return `Bearer ${buildNeGatewayBearerValue(token)}`
}
