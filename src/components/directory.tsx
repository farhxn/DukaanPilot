"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PlusIcon, MagnifyingGlassIcon, PersonIcon, Pencil1Icon, ArchiveIcon } from "@radix-ui/react-icons";
import { apiRequest, ClientError } from "./api-client";

type Contact = { id: string; name: string; phoneE164: string | null; notes: string | null; version: number; archivedAt: string | null };
type Page = { items: Contact[]; nextCursor: string | null };

export function Directory({ kind }: { kind: "customers" | "suppliers" }) {
  const singular = kind === "customers" ? "customer" : "supplier";
  const [items, setItems] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const requestRef = useRef({ signature: "", key: "" });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, archived: String(archived), limit: "25" });
    if (cursor) params.set("cursor", cursor);
    apiRequest<Page>(`/api/v1/${kind}?${params}`, { signal: controller.signal }).then(page => {
      setItems(page.items); setNextCursor(page.nextCursor); setLoading(false);
    }).catch(failure => {
      if (failure instanceof Error && failure.name === "AbortError") return;
      setError(failure instanceof Error ? failure.message : "Contacts could not be loaded."); setLoading(false);
    });
    return () => controller.abort();
  }, [kind, query, archived, cursor, refresh]);

  function reload() { setLoading(true); setError(""); setRefresh(value => value + 1); }
  function openForm(contact: Contact | "new") {
    setEditing(contact); setName(contact === "new" ? "" : contact.name); setPhone(contact === "new" ? "" : contact.phoneE164 ?? ""); setNotes(contact === "new" ? "" : contact.notes ?? ""); setFields({}); setError(""); setNotice("");
  }

  async function write(url: string, method: string, payload: unknown) {
    const signature = JSON.stringify({ url, method, payload });
    if (requestRef.current.signature !== signature) requestRef.current = { signature, key: crypto.randomUUID() };
    return apiRequest<Contact>(url, { method, body: payload, key: requestRef.current.key });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true); setError(""); setFields({});
    const existing = editing !== "new" ? editing : null;
    try {
      await write(`/api/v1/${kind}${existing ? `/${existing.id}` : ""}`, existing ? "PATCH" : "POST", { name, phoneE164: phone || null, notes: notes || null, ...(existing ? { version: existing.version } : {}) });
      setEditing(null); setNotice(`${existing ? "Updated" : "Added"} ${singular}.`); requestRef.current.signature = "";
      setCursor(null); reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This contact could not be saved.");
      if (failure instanceof ClientError) setFields(failure.fields);
    } finally { setPending(false); }
  }

  async function archive(contact: Contact) {
    setPending(true); setError(""); setNotice("");
    try {
      await write(`/api/v1/${kind}/${contact.id}`, "PATCH", { version: contact.version, archived: !archived });
      setNotice(`${archived ? "Restored" : "Archived"} ${contact.name}.`); requestRef.current.signature = "";
      setCursor(null); reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "This contact could not be updated."); }
    finally { setPending(false); }
  }

  return <>
    <section className="directory-tools"><form onSubmit={event => { event.preventDefault(); setQuery(search); setCursor(null); setLoading(true); setError(""); setRefresh(value => value + 1); }} className="search-form"><label className="sr-only" htmlFor="contact-search">Search contacts</label><MagnifyingGlassIcon /><input id="contact-search" placeholder={`Search ${kind} by name or phone`} value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /><button className="button button-outline" type="submit">Search</button></form><button className="button button-dark" onClick={() => openForm("new")} disabled={pending}><PlusIcon />Add {singular}</button></section>
    <div className="directory-tabs" aria-label="Contact status"><button aria-pressed={!archived} className={!archived ? "selected" : ""} onClick={() => { setArchived(false); setCursor(null); setLoading(true); setError(""); setRefresh(value => value + 1); }}>Active</button><button aria-pressed={archived} className={archived ? "selected" : ""} onClick={() => { setArchived(true); setCursor(null); setLoading(true); setError(""); setRefresh(value => value + 1); }}>Archived</button><span>Contacts directory · financial records are in Ledger & udhaar</span></div>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <div className="error-notice" role="alert"><p>{error}</p><button className="text-link" onClick={reload}>Refresh contacts</button></div>}
    {editing && <section className="panel contact-editor"><div className="panel-heading"><h2>{editing === "new" ? `Add ${singular}` : `Edit ${singular}`}</h2><button className="button button-outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</button></div><form onSubmit={save}><div className="form-grid"><label>Name<input autoFocus name="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} aria-invalid={!!fields.name} />{fields.name && <span className="field-error">{fields.name}</span>}</label><label>Phone number (optional)<input name="phoneE164" type="tel" maxLength={40} placeholder="03xx xxxxxxx or +country code" value={phone} onChange={event => setPhone(event.target.value)} aria-invalid={!!fields.phoneE164} />{fields.phoneE164 && <span className="field-error">{fields.phoneE164}</span>}</label><label className="full-width">Notes (optional)<textarea name="notes" maxLength={2000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} aria-invalid={!!fields.notes} />{fields.notes && <span className="field-error">{fields.notes}</span>}</label></div><p className="form-hint">Names can repeat. Use the phone number and contact ID to select the right person. Archived phone numbers stay reserved.</p><button type="submit" className="button button-dark" disabled={pending}>{pending ? "Saving…" : `Save ${singular}`}</button></form></section>}
    <section className="panel directory-panel" aria-busy={loading} aria-label={`${kind} directory`}>
      {loading ? <p className="directory-loading" role="status">Loading contacts…</p> : items.length ? <div className="contact-list">{items.map(contact => <article className="contact-row" key={contact.id}><span className="contact-avatar"><PersonIcon /></span><div className="contact-details"><h2>{contact.name}</h2><p>{contact.phoneE164 ?? "No phone number"}<span className="contact-id">ID {contact.id.slice(0, 8)}</span></p>{contact.notes && <p className="contact-notes">{contact.notes}</p>}</div><div className="contact-actions"><button className="button button-outline" disabled={pending} aria-label={`Edit ${contact.name}`} onClick={() => openForm(contact)}><Pencil1Icon /><span>Edit</span></button><button className="button button-outline" disabled={pending} aria-label={`${archived ? "Restore" : "Archive"} ${contact.name}`} onClick={() => archive(contact)}><ArchiveIcon /><span>{archived ? "Restore" : "Archive"}</span></button></div></article>)}</div> : <div className="section-empty directory-empty"><span className="section-empty-icon"><PersonIcon /></span><h2>{query ? "No matching contacts." : archived ? "No archived contacts." : `Your first ${singular} starts here.`}</h2><p>{query ? "Try a different name or phone number." : archived ? "Archived contacts can be restored here." : "Add a contact to keep their details together in your own business workspace."}</p></div>}
      <div className="directory-pagination"><span>{loading ? "" : `${items.length} contacts on this page`}</span><div>{cursor && <button className="button button-outline" disabled={loading} onClick={() => { setCursor(null); setLoading(true); }}>First page</button>}{nextCursor && <button className="button button-outline" disabled={loading} onClick={() => { setCursor(nextCursor); setLoading(true); }}>Next page</button>}</div></div>
    </section>
  </>;
}
