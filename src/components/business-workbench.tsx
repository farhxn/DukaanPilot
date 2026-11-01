"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PlusIcon, CheckCircledIcon, ReaderIcon } from "@radix-ui/react-icons";
import { apiRequest, failureMessage } from "./api-client";
import { nextMonthFirst } from "@/lib/instruction-date";
import { formatPkr, rupeesToPaisa } from "@/lib/money";
import type { FinancialPayload } from "@/server/domain/financial-normalization";

type Intent = "CREATE_ORDER" | "UPDATE_ORDER" | "POST_SALE" | "RECORD_PAYMENT" | "REVERSE_SALE" | "REVERSE_PAYMENT";
type Proposal = { id: string; intent: string; payload: FinancialPayload; version: number; payloadHash: string; expiresAt: string; status: string };
type Customer = { id: string; name: string; phoneE164: string | null; isWalkIn: boolean };
type Item = { description: string; quantity: string; price: string };
type RecordRow = { id: string; status: string; version: number; customerId?: string; customer?: { name: string }; totalPaisa?: string; amountPaisa?: string; dueAt?: string; notes?: string | null; items?: { description: string; quantity: string; unitPricePaisa: string | null }[]; sale?: { id: string } | null; postedAt?: string; receivedAt?: string; createdAt?: string; allocations?: { amountPaisa: string; reversedAt: string | null }[]; intent?: string; payload?: FinancialPayload; payloadHash?: string; expiresAt?: string };
type Summary = { salesPaisa: string; collectionsPaisa: string; outstandingPaisa: string; pendingOrders: number; pendingApprovals: number; summary: string };
type FollowUp = { id: string; orderId: string; state: string; checksUsed: number; maxChecks: number; ownerRemindersUsed: number; maxOwnerReminders: number; customerUpdatesUsed: number; maxCustomerUpdates: number; expiresAt: string; nextRunAt: string | null; terminalReason: string | null; order: { customer: { name: string } }; events: { id: string; type: string }[] };
const titles: Record<string, string> = { CREATE_ORDER: "Create order", UPDATE_ORDER: "Update order", CHANGE_ORDER_STATUS: "Change order status", POST_SALE: "Record sale", RECORD_PAYMENT: "Record payment", REVERSE_SALE: "Reverse sale", REVERSE_PAYMENT: "Reverse payment" };
const amountInput = (paisa?: string | null) => paisa === undefined || paisa === null ? "" : `${BigInt(paisa) / 100n}.${(BigInt(paisa) % 100n).toString().padStart(2, "0")}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function BusinessWorkbench({ section, whatsappEnabled = false, followUpEnabled = true }: { section: "orders" | "ledger" | "approvals"; whatsappEnabled?: boolean; followUpEnabled?: boolean }) {
  const [records, setRecords] = useState<RecordRow[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null), [cursor, setCursor] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]), [customerSearch, setCustomerSearch] = useState(""), [query, setQuery] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null), [tab, setTab] = useState<"sales" | "payments">("sales"), [approvalStatus, setApprovalStatus] = useState("READY");
  const [workflows, setWorkflows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [refresh, setRefresh] = useState(0);
  const [preview, setPreview] = useState<Proposal | null>(null), [editor, setEditor] = useState<Intent | null>(null), [editing, setEditing] = useState<Proposal | null>(null);
  const [channelCommand, setChannelCommand] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(""), [total, setTotal] = useState(""), [received, setReceived] = useState("0"), [method, setMethod] = useState("CASH");
  const [dueAt, setDueAt] = useState(""), [notes, setNotes] = useState(""), [reason, setReason] = useState(""), [sourceId, setSourceId] = useState(""), [linkedOrder, setLinkedOrder] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", price: "" }]);
  const [historyCustomer, setHistoryCustomer] = useState(""), [history, setHistory] = useState<{ balancePaisa: string; items: { id: string; kind: string; direction: string; amountPaisa: string; effectiveAt: string }[]; nextCursor: string | null } | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const retry = useRef({ signature: "", key: "" });
  const resource = section === "approvals" ? "proposals" : section === "orders" ? "orders" : tab;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "25" });
    if (cursor) params.set("cursor", cursor);
    if (section === "approvals") params.set("status", approvalStatus);
    Promise.all([
      apiRequest<{ items: RecordRow[]; nextCursor: string | null }>(`/api/v1/${resource}?${params}`, { signal: controller.signal }),
      apiRequest<Customer[]>(`/api/v1/customers/options?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
      apiRequest<Summary>("/api/v1/dashboard", { signal: controller.signal }),
      section === "orders" ? apiRequest<FollowUp[]>("/api/v1/workflows", { signal: controller.signal }) : Promise.resolve([] as FollowUp[]),
    ]).then(([page, options, data, followUps]) => { setRecords(page.items); setNextCursor(page.nextCursor); setCustomers(options); setSummary(data); setWorkflows(followUps); setLoading(false); })
      .catch(failure => { if (failure instanceof Error && failure.name === "AbortError") return; setError(failure instanceof Error ? failure.message : "Records could not be loaded."); setLoading(false); });
    return () => controller.abort();
  }, [resource, cursor, query, approvalStatus, refresh, section]);

  useEffect(() => {
    if (!historyCustomer) return;
    const controller = new AbortController();
    apiRequest<NonNullable<typeof history>>(`/api/v1/customers/${historyCustomer}/ledger?limit=50${historyCursor ? `&cursor=${historyCursor}` : ""}`, { signal: controller.signal }).then(setHistory).catch(failure => { if (!(failure instanceof Error && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "Ledger could not be loaded."); });
    return () => controller.abort();
  }, [historyCustomer, historyCursor, refresh]);

  function reload() { setLoading(true); setError(""); setRefresh(value => value + 1); }
  async function write<T>(url: string, body: unknown, method = "POST") {
    const signature = JSON.stringify({ url, body, method });
    if (retry.current.signature !== signature) retry.current = { signature, key: crypto.randomUUID() };
    const result = await apiRequest<T>(url, { method, body, key: retry.current.key });
    retry.current.signature = "";
    return result;
  }
  function newEditor(intent: Intent) {
    setEditor(intent); setEditing(null); setPreview(null); setChannelCommand(null); setError(""); setNotice(""); setCustomerId(""); setTotal(""); setReceived("0"); setMethod("CASH"); setDueAt(new Date(new Date(nextMonthFirst()).getTime() + 5 * 3600000).toISOString().slice(0, 16)); setNotes(""); setReason(""); setSourceId(""); setLinkedOrder(""); setItems([{ description: "", quantity: "1", price: "" }]);
  }
  function editPreview(proposal: Proposal) {
    const p = proposal.payload;
    newEditor(proposal.intent as Intent); setEditing(proposal); setCustomerId(p.customerId ?? ""); setTotal(amountInput(p.totalPaisa ?? p.amountPaisa)); setReceived(amountInput(p.receivedPaisa) || "0"); setMethod(p.method ?? "CASH"); setNotes(p.notes ?? ""); setReason(p.reason ?? ""); setSourceId(p.orderId ?? p.saleId ?? p.paymentId ?? ""); setLinkedOrder(proposal.intent === "POST_SALE" ? p.orderId ?? "" : "");
    if (p.dueAt) setDueAt(new Date(new Date(p.dueAt).getTime() + 5 * 3600000).toISOString().slice(0, 16));
    if (p.items) setItems(p.items.map(item => ({ description: item.description, quantity: item.quantity, price: amountInput(item.unitPricePaisa) })));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    setPending(true); setError("");
    try {
      let payload: Record<string, unknown>;
      if (editor === "CREATE_ORDER" || editor === "UPDATE_ORDER") payload = { ...(editor === "CREATE_ORDER" ? { customerId } : { orderId: sourceId }), items: items.map(item => ({ description: item.description, quantity: item.quantity, ...(item.price ? { unitPricePaisa: rupeesToPaisa(item.price) } : {}) })), ...(total ? { totalPaisa: rupeesToPaisa(total) } : {}), dueAt: new Date(dueAt + "+05:00").toISOString(), notes: notes || null };
      else if (editor === "POST_SALE") payload = { customerId, totalPaisa: rupeesToPaisa(total), receivedPaisa: rupeesToPaisa(received), method, ...(dueAt ? { dueAt: new Date(dueAt + "+05:00").toISOString() } : {}), ...(linkedOrder ? { orderId: linkedOrder } : {}) };
      else if (editor === "RECORD_PAYMENT") payload = { customerId, amountPaisa: rupeesToPaisa(total), method };
      else payload = { [editor === "REVERSE_SALE" ? "saleId" : "paymentId"]: sourceId, reason };
      const proposal = await write<Proposal>(editing ? `/api/v1/proposals/${editing.id}` : "/api/v1/proposals", editing ? { version: editing.version, payload } : { intent: editor, payload }, editing ? "PATCH" : "POST");
      setPreview(proposal); setEditor(null); setEditing(null); reload();
    } catch (failure) { setError(failureMessage(failure, "Preview could not be created.")); }
    finally { setPending(false); }
  }
  async function quickPreview(intent: string, payload: unknown) {
    setPending(true); setError(""); setNotice("");
    try { setPreview(await write<Proposal>("/api/v1/proposals", { intent, payload })); setEditor(null); reload(); }
    catch (failure) { setError(failureMessage(failure, "Preview could not be created.")); }
    finally { setPending(false); }
  }
  async function followUp(url: string) {
    setPending(true); setError(""); setNotice("");
    try { await write(url, {}); setNotice(url.endsWith("/stop") ? "Follow-up stopped. Unsent messages are cancelled." : "Bounded follow-up enabled. Check its status below; WhatsApp availability and permission still apply."); reload(); }
    catch (failure) { setError(failureMessage(failure, "Follow-up could not be changed.")); }
    finally { setPending(false); }
  }
  async function decide(approve: boolean) {
    if (!preview) return;
    setPending(true); setError("");
    try {
      await write(`/api/v1/proposals/${preview.id}/${approve ? "approve" : "reject"}`, { version: preview.version, ...(approve ? { payloadHash: preview.payloadHash } : {}) });
      setPreview(null); setNotice(approve ? "Approved and saved once." : "Proposal rejected. Nothing posted."); setCursor(null); reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "This decision could not be confirmed."); }
    finally { setPending(false); }
  }
  const orderEditor = editor === "CREATE_ORDER" || editor === "UPDATE_ORDER", reversalEditor = editor === "REVERSE_SALE" || editor === "REVERSE_PAYMENT";
  return <>
    {summary && <section className="financial-totals"><article><span>Today’s recorded sales</span><strong>{formatPkr(summary.salesPaisa)}</strong></article><article><span>Today’s owner-confirmed receipts</span><strong>{formatPkr(summary.collectionsPaisa)}</strong></article><article><span>Current outstanding</span><strong>{formatPkr(summary.outstandingPaisa)}</strong></article></section>}
    <div className="workbench-actions">{section === "orders" && <button className="button button-dark" disabled={pending} onClick={() => newEditor("CREATE_ORDER")}><PlusIcon />New order preview</button>}{section === "ledger" && <><button className="button button-dark" disabled={pending} onClick={() => newEditor("POST_SALE")}>Record sale</button><button className="button button-outline" disabled={pending} onClick={() => newEditor("RECORD_PAYMENT")}>Record payment</button></>}<button className="button button-outline" onClick={reload} disabled={pending}>Refresh records</button></div>
    {notice && <p className="form-success" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {editor && <section className="panel financial-editor"><div className="panel-heading"><h2>{titles[editor]}</h2><button className="button button-outline" disabled={pending} onClick={() => setEditor(null)}>Cancel</button></div><p className="form-hint">This creates a preview. Nothing financial posts until you approve it.</p><form onSubmit={submit}>
      {!reversalEditor && <><div className="customer-search"><label>Find customer<input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Search name or phone" /></label><button type="button" className="button button-outline" onClick={() => { setQuery(customerSearch); setRefresh(value => value + 1); }}>Find</button></div><label>Customer<select aria-label="Customer" required value={customerId} disabled={editor === "UPDATE_ORDER" || !!linkedOrder} onChange={event => setCustomerId(event.target.value)}><option value="">Choose a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id} disabled={customer.isWalkIn && (orderEditor || editor === "RECORD_PAYMENT")}>{customer.name}{customer.phoneE164 ? ` · ${customer.phoneE164}` : ""} · {customer.id.slice(0, 8)}</option>)}</select></label></>}
      {orderEditor && <><div className="order-line-list">{items.map((item, index) => <div className="order-line" key={index}><label>Item {index + 1} description<input required maxLength={200} value={item.description} onChange={event => setItems(current => current.map((line, i) => i === index ? { ...line, description: event.target.value } : line))} /></label><label>Item {index + 1} quantity<input required inputMode="decimal" value={item.quantity} onChange={event => setItems(current => current.map((line, i) => i === index ? { ...line, quantity: event.target.value } : line))} /></label><label>Item {index + 1} unit price (PKR)<input inputMode="decimal" value={item.price} placeholder="Optional" onChange={event => setItems(current => current.map((line, i) => i === index ? { ...line, price: event.target.value } : line))} /></label><button className="button button-outline" type="button" disabled={items.length === 1} onClick={() => setItems(current => current.filter((_, i) => i !== index))}>Remove item {index + 1}</button></div>)}</div><button type="button" className="button button-outline" disabled={items.length >= 30} onClick={() => setItems(current => [...current, { description: "", quantity: "1", price: "" }])}>Add item</button><label>Due date and time (Pakistan)<input required type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label><label>Order notes<textarea rows={2} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label></>}
      {!reversalEditor && <label>{editor === "RECORD_PAYMENT" ? "Payment amount (PKR)" : orderEditor ? "Order total (PKR; required if item prices are missing)" : "Sale total (PKR)"}<input inputMode="decimal" required={!orderEditor || items.some(item => !item.price)} value={total} onChange={event => setTotal(event.target.value)} /></label>}
      {editor === "POST_SALE" && <><label>Money received now (PKR)<input required inputMode="decimal" value={received} onChange={event => setReceived(event.target.value)} /></label><label>Repayment due date and time (Pakistan)<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /><span className="form-hint">For unpaid amounts; defaults to the first of next month at 9:00 AM. Ignored for fully paid sales.</span></label></>}
      {!orderEditor && !reversalEditor && <label>Receipt method<select aria-label="Receipt method" value={method} onChange={event => setMethod(event.target.value)}><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer (confirmed by you)</option><option value="OTHER">Other</option></select></label>}
      {reversalEditor && <label>Reason for correction<textarea required rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>}
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Preparing preview…" : editing ? "Update preview" : "Create preview"}</button>
    </form></section>}
    {preview && <section className="panel action-preview" aria-label="Action preview"><div className="panel-heading"><h2><CheckCircledIcon />Review: {titles[preview.intent] ?? preview.intent}</h2><span className="subtle-badge">Awaiting your approval</span></div><PreviewDetails proposal={preview} />{channelCommand && <><pre className="secure-command">{channelCommand}</pre><p className="form-hint">After reviewing this exact preview, send the command from your paired owner number within 10 minutes. A material edit invalidates it.</p></>}<div className="form-actions"><button className="button button-dark" disabled={pending} onClick={() => decide(true)}>Approve and save</button>{whatsappEnabled && <button className="button button-outline" disabled={pending} onClick={async () => { setPending(true); setError(""); try { const control = await write<{ command: string | null }>(`/api/v1/proposals/${preview.id}/channel-control`, {}); setChannelCommand(control.command); if (!control.command) setNotice("This approval command was already displayed. Generate a fresh command if needed."); } catch (failure) { setError(failureMessage(failure, "Pair your owner WhatsApp number first.")); } finally { setPending(false); } }}>Create WhatsApp approval command</button>}<button className="button button-outline" disabled={pending} onClick={() => decide(false)}>Reject proposal</button>{preview.intent !== "CHANGE_ORDER_STATUS" && <button className="button button-outline" disabled={pending} onClick={() => editPreview(preview)}>Edit preview</button>}</div><p className="form-hint">Expires {dateLabel(preview.expiresAt)}. A changed balance or record requires a fresh review.</p></section>}
    {section === "orders" && workflows.length > 0 && <section className="panel financial-editor" aria-label="Order follow-ups"><h2>Pending-order follow-ups</h2><p>One lifetime per order. Up to three checks, two owner reminders and one separately approved customer update. Scheduled checks use no AI.</p>{workflows.map(workflow => <article className="channel-message" key={workflow.id}><h3>{workflow.order.customer.name} · {workflow.state.replaceAll("_", " ")}</h3><p>Checks {workflow.checksUsed}/{workflow.maxChecks} · Owner reminders {workflow.ownerRemindersUsed}/{workflow.maxOwnerReminders} · Customer updates {workflow.customerUpdatesUsed}/{workflow.maxCustomerUpdates}</p><p>Deadline {dateLabel(workflow.expiresAt)}{workflow.nextRunAt ? ` · Next check ${dateLabel(workflow.nextRunAt)}` : ""}</p>{workflow.terminalReason && <p>Review manually: {workflow.terminalReason.replaceAll("_", " ").toLowerCase()}.</p>}{["SCHEDULED", "CHECKING", "WAITING_OWNER"].includes(workflow.state) && <button className="button button-outline" disabled={pending} onClick={() => followUp(`/api/v1/workflows/${workflow.id}/stop`)}>Stop follow-up</button>}</article>)}</section>}
    {section === "ledger" && <section className="panel ledger-tools"><div className="panel-heading"><h2>Customer ledger</h2></div><label>View customer ledger<select aria-label="View customer ledger" value={historyCustomer} onChange={event => { setHistoryCustomer(event.target.value); setHistoryCursor(null); setHistory(null); }}><option value="">Choose a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phoneE164 ?? customer.id.slice(0, 8)}</option>)}</select></label>{history && <><p className="ledger-balance">Current balance <strong>{formatPkr(history.balancePaisa)}</strong></p><div className="ledger-entries">{history.items.map(entry => <div key={entry.id}><span>{entry.kind.replaceAll("_", " ")}<small>{dateLabel(entry.effectiveAt)}</small></span><strong>{entry.direction === "DEBIT" ? "+" : "−"}{formatPkr(entry.amountPaisa)}</strong></div>)}</div>{history.nextCursor && <button className="button button-outline" onClick={() => setHistoryCursor(history.nextCursor)}>Older entries</button>}</>}<div className="export-tools"><label>Export from<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Export to<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><a className="button button-outline" href={`/api/v1/exports/ledger.csv${from || to ? `?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}` : ""}`}>Export ledger CSV</a></div></section>}
    {section === "ledger" && <div className="directory-tabs"><button className={tab === "sales" ? "selected" : ""} onClick={() => { setTab("sales"); setCursor(null); setLoading(true); }}>Sales</button><button className={tab === "payments" ? "selected" : ""} onClick={() => { setTab("payments"); setCursor(null); setLoading(true); }}>Payments</button></div>}
    {section === "approvals" && <label className="approval-filter">Proposal status<select aria-label="Proposal status" value={approvalStatus} onChange={event => { setApprovalStatus(event.target.value); setCursor(null); setLoading(true); }}><option value="READY">Awaiting review</option><option value="EXECUTED">Approved and saved</option><option value="REJECTED">Rejected</option></select></label>}
    <section className="panel business-records" aria-busy={loading}>{loading ? <p className="directory-loading" role="status">Loading records…</p> : records.length ? records.map(record => <article key={record.id} className="business-record"><div className="record-heading"><div><h2>{section === "approvals" ? titles[record.intent!] ?? record.intent : record.customer?.name}</h2><p>{section === "approvals" ? record.payload?.customerName : `${record.status} · ${record.id.slice(0, 8)}`}</p></div><span className="subtle-badge">{record.status}</span></div>{(record.totalPaisa || record.amountPaisa) && <strong className="record-amount">{formatPkr(record.totalPaisa ?? record.amountPaisa!)}</strong>}{record.dueAt && <p>Due {dateLabel(record.dueAt)}</p>}{record.items && <p>{record.items.map(item => `${item.quantity} × ${item.description}`).join(", ")}</p>}<div className="form-actions">
      {section === "approvals" && record.status === "READY" && <button className="button button-dark" onClick={() => { setPreview(record as unknown as Proposal); setEditor(null); setError(""); }}>Review proposal</button>}
      {section === "orders" && record.status === "PENDING" && <><button className="button button-outline" disabled={pending} onClick={() => quickPreview("CHANGE_ORDER_STATUS", { orderId: record.id, status: "FULFILLED" })}>Mark fulfilled</button><button className="button button-outline" disabled={pending} onClick={() => quickPreview("CHANGE_ORDER_STATUS", { orderId: record.id, status: "CANCELLED" })}>Cancel order</button><button className="button button-outline" disabled={pending} onClick={() => { newEditor("UPDATE_ORDER"); setSourceId(record.id); setCustomerId(record.customerId!); setTotal(amountInput(record.totalPaisa)); setNotes(record.notes ?? ""); setDueAt(new Date(new Date(record.dueAt!).getTime() + 5 * 3600000).toISOString().slice(0, 16)); setItems(record.items!.map(item => ({ description: item.description, quantity: item.quantity, price: amountInput(item.unitPricePaisa) }))); }}>Edit order</button></>}
      {followUpEnabled && section === "orders" && record.status === "PENDING" && !workflows.some(workflow => workflow.orderId === record.id) && <button className="button button-outline" disabled={pending} onClick={() => followUp(`/api/v1/orders/${record.id}/follow-up`)}>Enable bounded follow-up</button>}
      {section === "orders" && record.status === "FULFILLED" && !record.sale && <button className="button button-outline" disabled={pending} onClick={() => { newEditor("POST_SALE"); setCustomerId(record.customerId!); setTotal(amountInput(record.totalPaisa)); setLinkedOrder(record.id); }}>Create sale preview</button>}
      {section === "ledger" && record.status === "POSTED" && <button className="button button-outline" disabled={pending} onClick={() => { newEditor(tab === "sales" ? "REVERSE_SALE" : "REVERSE_PAYMENT"); setSourceId(record.id); }}>Correct {tab === "sales" ? "sale" : "payment"}</button>}
    </div></article>) : <div className="section-empty directory-empty"><span className="section-empty-icon"><ReaderIcon /></span><h2>{section === "approvals" ? "No proposals in this view." : "No records yet."}</h2><p>{section === "approvals" ? "Create a manual or assistant preview before reviewing an action." : "Start with a preview. You’ll review every action before it’s saved."}</p></div>}<div className="directory-pagination"><span>{records.length} records on this page</span><div>{cursor && <button className="button button-outline" onClick={() => { setCursor(null); setLoading(true); }}>First page</button>}{nextCursor && <button className="button button-outline" onClick={() => { setCursor(nextCursor); setLoading(true); }}>Next page</button>}</div></div></section>
  </>;
}

function PreviewDetails({ proposal }: { proposal: Proposal }) {
  const p = proposal.payload;
  return <><dl className="preview-values">{p.customerName && <div><dt>Customer</dt><dd>{p.customerName}</dd></div>}{p.totalPaisa && <div><dt>Total</dt><dd>{formatPkr(p.totalPaisa)}</dd></div>}{p.receivedPaisa !== undefined && <div><dt>Received now</dt><dd>{formatPkr(p.receivedPaisa)}</dd></div>}{p.amountPaisa && <div><dt>Amount</dt><dd>{formatPkr(p.amountPaisa)}</dd></div>}{p.expectedBalancePaisa !== undefined && <div><dt>Current outstanding</dt><dd>{formatPkr(p.expectedBalancePaisa)}</dd></div>}{p.resultingBalancePaisa !== undefined && <div><dt>Outstanding after this action</dt><dd>{formatPkr(p.resultingBalancePaisa)}</dd></div>}{p.dueAt && <div><dt>Due (Pakistan)</dt><dd>{dateLabel(p.dueAt)}</dd></div>}{p.status && <div><dt>New order status</dt><dd>{p.status}</dd></div>}{p.method && <div><dt>Receipt method</dt><dd>{p.method.replaceAll("_", " ")} · confirmed by owner</dd></div>}{p.reason && <div><dt>Correction reason</dt><dd>{p.reason}</dd></div>}</dl>{p.items && <div className="preview-items">{p.items.map((item, index) => <p key={index}>{item.quantity} × {item.description}{item.lineTotalPaisa !== null ? ` · ${formatPkr(item.lineTotalPaisa)}` : ""}</p>)}<p className="form-hint">{p.pricingMode === "PRICED" ? "Total calculated from entered item prices." : "Descriptive items; total entered by owner."} An order does not post a sale.</p></div>}{p.allocations && <div className="preview-items"><h3>Receipt allocations</h3>{p.allocations.map(item => <p key={item.saleId}>Sale {item.saleId.slice(0, 8)} · {formatPkr(item.amountPaisa)}</p>)}</div>}</>;
}
