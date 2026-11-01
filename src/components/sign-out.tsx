"use client";
import { useState } from "react";
import { apiRequest } from "./api-client";
export function SignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div><button className="button button-outline" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try { await apiRequest("/api/v1/auth/session", { method: "DELETE" }); window.location.replace(new URL("/login", window.location.origin).href); }
    catch { setError("We couldn’t confirm sign-out. Please retry."); setPending(false); }
  }}>{pending ? "Signing out…" : "Sign out"}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
