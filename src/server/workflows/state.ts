export const ACTIVE_WORKFLOW_STATES = ["SCHEDULED", "CHECKING", "WAITING_OWNER"] as const;
export const HOUR = 3600000;
export function workflowWindow(enabledAt: Date, dueAt: Date, lifetimeHours = 72) {
  const startAt = new Date(Math.max(enabledAt.getTime(), dueAt.getTime() - 24 * HOUR));
  const expiresAt = new Date(Math.min(startAt.getTime() + Math.min(72, lifetimeHours) * HOUR, dueAt.getTime() + 24 * HOUR));
  return { startAt, expiresAt };
}
export function isActive(state: string) { return (ACTIVE_WORKFLOW_STATES as readonly string[]).includes(state); }
export function workflowStop(snapshot: { state: string; expiresAt: Date; dueAtSnapshot: Date }, order: { dueAt: Date; status: string }, now: Date, active: boolean, optedOut: boolean) {
  if (!isActive(snapshot.state)) return { state: snapshot.state, reason: "ALREADY_TERMINAL" };
  if (order.status === "FULFILLED") return { state: "RESOLVED", reason: "ORDER_FULFILLED" };
  if (order.status === "CANCELLED") return { state: "CANCELLED", reason: "ORDER_CANCELLED" };
  if (order.dueAt.getTime() !== snapshot.dueAtSnapshot.getTime()) return { state: "NEEDS_HUMAN", reason: "DUE_DATE_CHANGED" };
  if (!active) return { state: "NEEDS_HUMAN", reason: "WORKSPACE_PAUSED" };
  if (optedOut) return { state: "CANCELLED", reason: "CONTACT_OPTED_OUT" };
  if (now >= snapshot.expiresAt) return { state: "EXPIRED", reason: "DEADLINE_REACHED" };
  return null;
}
