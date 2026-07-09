type Translate = (key: string) => string

/**
 * Returns the login submit button label for the NE login gate.
 */
export function neLoginSubmitLabel(pending: boolean, t: Translate) {
  return t(pending ? "ne.login.signingIn" : "ne.login.submit")
}
