import { expect, test } from "bun:test"
import { NE_TOKEN_ACCOUNT_URL } from "../../src/ne/constants"
import { fetchNeTokenAccount, parseNeTokenAccount } from "../../src/ne/account"

test("fetchNeTokenAccount authenticates with the stored NE AUT and maps ledger totals", async () => {
  const account = await fetchNeTokenAccount("AUT", async (input, init) => {
    expect(input.toString()).toBe(NE_TOKEN_ACCOUNT_URL)
    expect(init).toMatchObject({
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: "Bearer necli##AUT",
      },
    })
    return Response.json({
      data: {
        user_id: 10086,
        total_income: 100_000,
        total_expense: 21_500,
        total_write_off: 50,
        remaining: 78_500,
        purchased_balance: 50_000,
        gift_balance: 28_500,
        migration_balance: 0,
        debt_balance: 0,
        update_time: "2026-05-17T10:00:00Z",
      },
    })
  })

  expect(account).toEqual({
    remaining: 78_500,
    totalExpense: 21_500,
    totalWriteOff: 50,
    totalConsumed: 21_550,
    updateTime: "2026-05-17T10:00:00Z",
  })
})

test("parseNeTokenAccount rejects unsuccessful and malformed gateway responses", () => {
  expect(() => parseNeTokenAccount({ code: 500, message: "ledger unavailable" })).toThrow("ledger unavailable")
  expect(() =>
    parseNeTokenAccount({ data: { remaining: 10, total_expense: "2", total_write_off: 0 } }),
  ).toThrow('field "total_expense"')
})
