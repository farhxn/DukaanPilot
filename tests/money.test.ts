import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePaisa, rupeesToPaisa, formatPkr, quantityMills, lineTotal } from "../src/lib/money.ts";
import { dayRange, businessDate } from "../src/server/domain/reports.ts";

test("money parsing is exact at one paisa, maximum, and rejected decimals/floats", () => {
  assert.equal(rupeesToPaisa("0.01"), "1");
  assert.equal(rupeesToPaisa("10000000.00"), "1000000000");
  assert.equal(parsePaisa("65000"), 65000n);
  for (const value of [650, "0", "-1", "1.5", "1000000001", "NaN"]) assert.throws(() => parsePaisa(value));
  for (const value of ["0.001", "1,25", "1e3", "-1", "10000000.01"]) assert.throws(() => rupeesToPaisa(value));
  assert.equal(rupeesToPaisa("1,250"), "125000");
  assert.equal(rupeesToPaisa("۱,۰۰,۰۰۰.۵۰"), "10000050");
  assert.equal(formatPkr(45000n), "Rs 450.00");
  assert.equal(lineTotal(101n, quantityMills("0.5")), 51n);
});

test("Pakistan reporting day is a half-open UTC interval at local midnight", () => {
  const range = dayRange("2026-11-01");
  assert.equal(range.start.toISOString(), "2026-10-31T19:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-11-01T19:00:00.000Z");
  assert.equal(businessDate(new Date("2026-10-31T18:59:59Z")), "2026-10-31");
  assert.equal(businessDate(new Date("2026-10-31T19:00:00Z")), "2026-11-01");
  assert.throws(() => dayRange("2026-02-31"));
  assert.throws(() => dayRange("2026-11-02", "2026-11-01"));
});
