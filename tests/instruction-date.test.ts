import assert from "node:assert/strict";
import { test } from "node:test";
import { instructionDueDate, nextMonthFirst } from "../src/lib/instruction-date.ts";

test("written dates override model guesses, date-only uses 09:00 Pakistan, explicit time is preserved", () => {
  assert.equal(instructionDueDate("ali ko 600 udhare diye 1 december 2026 ko wapis kareyga"), "2026-12-01T04:00:00.000Z");
  assert.equal(instructionDueDate("due December 1, 2026 at 3 pm"), "2026-12-01T10:00:00.000Z");
  assert.equal(instructionDueDate("۱ دسمبر ۲۰۲۶ کو واپس کرے گا"), "2026-12-01T04:00:00.000Z");
  assert.equal(instructionDueDate("due 01/12/2026 at 14:30"), "2026-12-01T09:30:00.000Z");
  assert.equal(instructionDueDate("due 2026-12-01T14:00:00+05:00"), "2026-12-01T09:00:00.000Z");
  assert.equal(instructionDueDate("due 2026-12-01T14:00:00Z"), "2026-12-01T14:00:00.000Z");
});

test("missing date defaults on the Pakistan calendar including December rollover", () => {
  const now = new Date("2026-11-30T20:00:00Z"); // December 1 in Pakistan
  assert.equal(nextMonthFirst(now), "2027-01-01T04:00:00.000Z");
  assert.equal(instructionDueDate("Ali sale PKR 450.50 received 0", now), "2027-01-01T04:00:00.000Z");
  assert.equal(instructionDueDate("Ali sale 600 received 0", new Date("2026-11-01T00:00:00Z")), "2026-12-01T04:00:00.000Z");
  assert.equal(instructionDueDate("Ali sale 600 received 0, at 3 pm", new Date("2026-11-01T00:00:00Z")), "2026-12-01T10:00:00.000Z");
  assert.equal(instructionDueDate("May sale 600 received 0, 0300-1234567", new Date("2026-11-01T00:00:00Z")), "2026-12-01T04:00:00.000Z");
});

test("invalid, incomplete, multiple or ambiguous dates/times clarify instead of silently defaulting", () => {
  for (const text of ["due 100 December 2026", "due 1 Dec. 2026", "due 1 December 2026 at 3", "due 1 December 2026 at 3:7", "due 31 february 2026", "due 2026-02-30", "due 1 December", "due tomorrow", "due Friday", "due 1/2/26", "due 1 December 2026 or 2 December 2026", "due 1 December 2026 25:00", "due 1 December 2026 3 baje", "due 2026-12-01T14:00:00Z or 3 pm", "due 1 December 2026 at 3 pm UTC"]) assert.throws(() => instructionDueDate(text), Error, text);
});
