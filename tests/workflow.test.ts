import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, workflowStop, workflowWindow } from "../src/server/workflows/state.ts";
test("workflow window is fixed at owner enable/due boundaries with no late start", () => {
  const enabledAt = new Date("2030-01-01T04:00:00Z"), dueAt = new Date(enabledAt.getTime() + 72 * HOUR);
  const window = workflowWindow(enabledAt, dueAt);
  assert.equal(window.startAt.getTime(), dueAt.getTime() - 24 * HOUR);
  assert.equal(window.expiresAt.getTime(), dueAt.getTime() + 24 * HOUR);
  const lateDue = new Date(enabledAt.getTime() - 25 * HOUR);
  assert.ok(workflowWindow(enabledAt, lateDue).expiresAt <= enabledAt);
  assert.equal(workflowWindow(enabledAt, dueAt, 12).expiresAt.getTime() - window.startAt.getTime(), 12 * HOUR);
});
test("terminal/due-change/opt-out/deadline rules never infer financial or customer fulfillment", () => {
  const now = new Date("2030-01-01T04:00:00Z"), dueAt = new Date(now.getTime() + HOUR), expiresAt = new Date(now.getTime() + 2 * HOUR);
  const wf = { state: "SCHEDULED", dueAtSnapshot: dueAt, expiresAt }, order = { status: "PENDING", dueAt };
  assert.equal(workflowStop(wf, order, now, true, false), null);
  assert.equal(workflowStop(wf, { ...order, status: "FULFILLED" }, now, true, false)?.state, "RESOLVED");
  assert.equal(workflowStop(wf, { ...order, dueAt: new Date(dueAt.getTime() + 1) }, now, true, false)?.reason, "DUE_DATE_CHANGED");
  assert.equal(workflowStop(wf, order, now, true, true)?.state, "CANCELLED");
  assert.equal(workflowStop(wf, order, expiresAt, true, false)?.state, "EXPIRED");
  assert.equal(workflowStop({ ...wf, state: "FAILED" }, order, now, true, false)?.reason, "ALREADY_TERMINAL");
});
