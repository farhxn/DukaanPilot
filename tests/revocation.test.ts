import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionStillValid } from "../src/server/auth/revocation.ts";
test("production sessions fail closed for disabled, revoked, missing or malformed authentication times", () => {
  const time = new Date("2030-01-01T00:00:00Z");
  assert.equal(sessionStillValid({ disabled: false, tokensValidAfterTime: time.toISOString() }, time), true);
  assert.equal(sessionStillValid({ disabled: true }, time), false);
  assert.equal(sessionStillValid({ disabled: false, tokensValidAfterTime: new Date(time.getTime() + 1000).toISOString() }, time), false);
  assert.equal(sessionStillValid({ disabled: false, tokensValidAfterTime: "invalid" }, time), false);
  assert.equal(sessionStillValid({ disabled: false }), false);
});
