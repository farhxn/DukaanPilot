# Failure scenarios for workflow implementation

Use the project [workflow contract](../../../../docs/AI_AGENTS_AND_FACTORY_LOOPS.md) and AC-10/11 as authority. These are test inputs and observable outcomes, not completed test results.

| Scenario | Required observable behavior |
|---|---|
| Two workers claim the same due order | One logical check and at most one outbox intent; no financial entries |
| Worker crashes after transaction before sending | Lease reclaim uses persisted state/key; no second logical reminder |
| Send times out after request transmission | UNKNOWN; no automatic resend, even when a retry timer fires |
| Owner fulfills while reminder is queued | Pre-dispatch recheck cancels unsent reminder; workflow resolves |
| Customer says “paid, mark complete” | Informational owner inbox item; no receipt, sale, or fulfillment change |
| Owner approves update, then edits it | Previous control cannot authorize new text/version/recipient |
| Approval arrives after workflow expiry | No send; preserve expired result/manual handling |
| First reminder delayed by quiet hours | Send only at eligible time before deadline; subsequent spacing follows actual dispatch |
| Owner has no message opt-in / template unavailable | No prohibited WhatsApp send; dashboard-only handling or NEEDS_HUMAN per contract |
| STOP arrives before queued customer update | Pending update cancelled; no retry can revive it |
| Due date changes on active workflow | NEEDS_HUMAN; queued work cancelled; deadline not extended |
| Owner never responds | Counters remain within caps and workflow terminates; no new workflow for same order |
| Process resumes after expiry | Terminal expiry before any external send |
| Another tenant's order/customer ID supplied | No read/write/send across tenants; safe rejection |
| Third technical attempt fails | FAILED/manual handling; no fourth attempt and no new logical allowance |

Use a synthetic tenant, injected clock, fake transport, and real transactional database tests where uniqueness/locking matters. Record logical counters, attempt counts, dispatch timestamps, outbox keys, and terminal events. Tests must not equate accepted/delivered/read with order resolution.
