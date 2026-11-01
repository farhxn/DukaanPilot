"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ClientError } from "./api-client";
type Business = { id: string; name: string; profile: { businessType: string; city: string; language: string; version: number } | null };
export function BusinessForm({ business }: { business: Business | null }) {
  const router = useRouter();
  const [name, setName] = useState(business?.name ?? "");
  const [businessType, setBusinessType] = useState(business?.profile?.businessType ?? "");
  const [city, setCity] = useState(business?.profile?.city ?? "");
  const [language, setLanguage] = useState(business?.profile?.language ?? "roman-urdu");
  const [version, setVersion] = useState(business?.profile?.version);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const request = useRef({ signature: "", key: "" });
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError(""); setFields({}); setNotice("");
    const payload = { name, businessType, city, language, ...(business ? { version } : {}) };
    const signature = JSON.stringify(payload);
    if (request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    try {
      const saved = await apiRequest<Business>(business ? "/api/v1/business" : "/api/v1/businesses", { method: business ? "PATCH" : "POST", body: payload, key: request.current.key });
      if (!business) { window.location.replace(new URL("/customers", window.location.origin).href); return; }
      setVersion(saved.profile?.version); setNotice("Business profile saved."); setPending(false); router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your workspace could not be saved.");
      if (failure instanceof ClientError) setFields(failure.fields);
      setPending(false);
    }
  }
  return <form className="business-form" onSubmit={submit}><div className="form-grid"><label>Business name<input name="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} aria-invalid={!!fields.name} />{fields.name && <span className="field-error">{fields.name}</span>}</label><label>Business type<input name="businessType" required maxLength={80} placeholder="e.g. General store, bakery, tailor" value={businessType} onChange={event => setBusinessType(event.target.value)} aria-invalid={!!fields.businessType} />{fields.businessType && <span className="field-error">{fields.businessType}</span>}</label><label>City<input name="city" required maxLength={80} value={city} onChange={event => setCity(event.target.value)} aria-invalid={!!fields.city} />{fields.city && <span className="field-error">{fields.city}</span>}</label><label>Preferred language<select name="language" value={language} onChange={event => setLanguage(event.target.value)}><option value="roman-urdu">Roman Urdu</option><option value="urdu">Urdu</option><option value="english">English</option></select></label></div><p className="form-hint">One business and one owner. Currency: PKR. Business timezone: Asia/Karachi.</p>{error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}<button className="button button-dark" disabled={pending} type="submit">{pending ? "Saving…" : business ? "Save business profile" : "Create business workspace"}</button></form>;
}
