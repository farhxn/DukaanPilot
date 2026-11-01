"use client";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { apiRequest, failureMessage } from "./api-client";
import type { AssistantResult } from "@/server/ai/assistant";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AssistantForm({ enabled }: { enabled: boolean }) {
  // SSR controls stay disabled until React has attached submit/input handlers.
  // Otherwise a fast click can perform a native GET and discard the draft.
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [instruction, setInstruction] = useState(""), [pending, setPending] = useState(false), [message, setMessage] = useState(""), [proposal, setProposal] = useState<string | null>(null);
  const retry = useRef({ text: "", key: "" });
  const [customerStep, setCustomerStep] = useState<Extract<AssistantResult, { kind: "customer_required" }> | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const contactKey = useRef("");
  async function prepare(customerId?: string) {
    const signature = JSON.stringify({ instruction, customerId });
    if (retry.current.text !== signature) retry.current = { text: signature, key: crypto.randomUUID() };
    const result = await apiRequest<AssistantResult>("/api/v1/assistant", { method: "POST", body: { text: instruction, ...(customerId ? { customerId } : {}) }, key: retry.current.key });
    setMessage(result.message); setProposal(result.kind === "proposal" ? result.proposalId : null);
    setCustomerStep(result.kind === "customer_required" ? result : null);
    if (result.kind === "customer_required") { setCustomerName(result.customerName); contactKey.current = crypto.randomUUID(); }
  }
  async function chooseCustomer(id?: string) {
    setPending(true); setMessage("");
    try {
      if (!id) {
        const customer = await apiRequest<{ id: string }>("/api/v1/customers", { method: "POST", body: { name: customerName, phoneE164: customerPhone || null }, key: contactKey.current });
        id = customer.id;
      }
      await prepare(id);
    } catch (error) { setMessage(failureMessage(error, "Could not prepare the draft. Your instruction is still here.")); }
    finally { setPending(false); }
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault(); setPending(true); setMessage(""); setProposal(null);
    try {
      await prepare();
      // Keep the same key for repeat submissions of identical text, including
      // uncertain requests. Changing the instruction starts a new action.
    } catch (error) { setMessage(failureMessage(error, "The assistant is unavailable. Use manual entry.")); }
    finally { setPending(false); }
  }
  return <section className="panel financial-editor"><h2>Describe one action</h2><p>Roman Urdu, Urdu, or English. Include the customer and exact amounts. The assistant prepares a draft for you to review.</p><p className="form-hint">Write dates naturally, such as 1 December 2026 at 3 pm. A missing date defaults to the first of next month; a missing time uses 9:00 AM Pakistan time. Review the date before approving.</p>{!enabled && <p className="form-notice" role="status">The assistant is disconnected. You can record everything using the manual forms.</p>}<form onSubmit={submit}><label>Your business instruction<textarea dir="auto" rows={5} maxLength={2000} required value={instruction} onChange={event => { setInstruction(event.target.value); setCustomerPhone(""); setCustomerStep(null); setProposal(null); setMessage(""); }} disabled={!enabled || !hydrated || pending} placeholder="Ali ko Rs 650 ki sale, abhi Rs 0 mile." /></label><button className="button button-dark" disabled={!enabled || !hydrated || pending}>{pending ? "Preparing a draft…" : "Prepare draft"}</button></form>{message && <p className="form-notice" role="status" dir="auto">{message}</p>}{customerStep && <section aria-label="Resolve customer"><h3>{customerStep.reason === "archived" ? "Restore archived customer" : "Choose or add the customer"}</h3>{customerStep.reason !== "archived" && customerStep.matches.map(customer => <button key={customer.id} className="button button-outline" type="button" disabled={pending} onClick={() => chooseCustomer(customer.id)}>{customer.name}{customer.phoneE164 ? " · " + customer.phoneE164 : " · " + customer.id.slice(0, 8)}</button>)}{customerStep.reason === "missing" && <><label>New customer name<input value={customerName} maxLength={120} onChange={event => { setCustomerName(event.target.value); contactKey.current = crypto.randomUUID(); }} disabled={pending} /></label><label>Customer phone (optional)<input value={customerPhone} onChange={event => { setCustomerPhone(event.target.value); contactKey.current = crypto.randomUUID(); }} disabled={pending} /></label><button className="button button-dark" type="button" disabled={pending || !customerName.trim()} onClick={() => chooseCustomer()}>Add customer and prepare draft</button></>}<button className="button button-outline" type="button" disabled={pending} onClick={() => { retry.current = { text: "", key: "" }; void submit(); }}>Recheck after updating customers</button><Link className="button button-outline" href="/customers" target="_blank" rel="noopener noreferrer">Manage customers</Link><p className="form-hint">Customer changes are saved first. Preparing the draft uses another assistant action; financial records still require approval.</p></section>}{proposal && <Link className="button button-dark" href="/approvals">Review in Approvals</Link>}<div className="form-actions"><Link className="button button-outline" href="/orders">Enter an order</Link><Link className="button button-outline" href="/ledger">Enter a sale or receipt</Link></div><p className="form-hint">Nothing is posted until you approve the exact preview. Failed requests retain the same request key when retried.</p></section>;
}
