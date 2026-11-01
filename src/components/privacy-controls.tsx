"use client";
import { useState } from "react";
import { apiRequest } from "./api-client";
export function PrivacyControls() {
  const [pending, setPending] = useState(false), [notice, setNotice] = useState("");
  async function requestReview(kind: "EXPORT" | "DELETE") {
    setPending(true); setNotice("");
    try { await apiRequest("/api/v1/privacy-requests", { method: "POST", body: { kind }, key: crypto.randomUUID() }); setNotice(kind === "DELETE" ? "Deletion review requested. Your records have not been erased. Support must verify the request and explain retention and backup handling before changes." : "Export review requested. Support will review the scope and arrange a verified export."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "This request is unavailable. Please contact support."); }
    finally { setPending(false); }
  }
  return <section className="panel financial-editor"><h2>Your data</h2><p>Download your business records or request a support review. Deletion needs identity verification and a reviewed retention policy.</p><div className="form-actions"><a download className="button button-outline" href="/api/v1/exports/workspace">Download business data</a><button className="button button-outline" disabled={pending} onClick={() => requestReview("EXPORT")}>Request export review</button><button className="button button-outline" disabled={pending} onClick={() => requestReview("DELETE")}>Request deletion review</button></div>{notice && <p className="form-notice" role="status">{notice}</p>}</section>;
}
