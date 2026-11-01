import type { Metadata } from "next";
import Link from "next/link";
import { getPublicAuthSettings } from "@/server/auth/firebase";
import { currentIdentity } from "@/server/auth/session";
import { LoginForm } from "@/components/login-form";
import { SignOut } from "@/components/sign-out";
export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage() {
  const settings = getPublicAuthSettings();
  const identity = await currentIdentity();
  return <><div className="page-heading"><div><h1>Sign in</h1><p>Your business records belong in your own workspace.</p></div></div><section className="panel auth-panel"><span className="subtle-badge">{settings.emulatorUrl ? "Local test account" : "Business owner"}</span><h2>{identity ? "You’re signed in." : "Welcome to your workspace."}</h2>{identity ? <><p>Signed in as {identity.email}.</p><div className="form-actions"><Link className="button button-dark" href="/setup">Open workspace setup</Link><SignOut /></div></> : settings.enabled ? <><p>Sign in, then create or open your business workspace.</p><LoginForm settings={settings} /></> : <><p>Sign-in configuration is not enabled yet. No credentials or business records are collected by this preview.</p><Link href="/setup" className="button button-dark">See workspace setup</Link></>}</section></>;
}
