import type { Metadata } from "next";
import Link from "next/link";
import { currentIdentity } from "@/server/auth/session";
import { getServerConfig } from "@/server/config";
import { getDb } from "@/server/db";
import { getBusiness } from "@/server/domain/business";
import { BusinessForm } from "@/components/business-form";
import { channelStatus } from "@/server/whatsapp/pairing";
import { PrivacyControls } from "@/components/privacy-controls";
import { SignOut } from "@/components/sign-out";
export const metadata: Metadata = { title: "Workspace setup" };
export default async function SetupPage() {
  const config = getServerConfig();
  const identity = await currentIdentity();
  const business = identity ? await getBusiness(getDb(), identity) : null;
  const channel = identity && business ? await channelStatus(getDb(), identity) : null;
  return <><div className="page-heading"><div><h1>Workspace setup</h1><p>Your business, your records, your own space.</p></div>{identity && <SignOut />}</div><section className="panel setup-profile"><h2>{business ? "Your business profile" : "Make this workspace yours"}</h2>{identity ? <><p className="panel-description">Signed in as {identity.email}. Business changes apply only to this owner’s workspace.</p><BusinessForm business={business} /></> : <><p className="panel-description">{config.authEnabled ? "Sign in before creating or opening your business workspace." : "Firebase sign-in and business storage need local configuration before accounts can be created."}</p><Link href="/login" className="button button-dark">{config.authEnabled ? "Sign in to continue" : "See sign-in status"}</Link></>}</section><section className="panel setup-status"><h2>Connection status</h2><dl><div><dt>Business account</dt><dd>{business ? business.name : "Not created"}</dd></div><div><dt>Record storage</dt><dd>{business ? "Connected" : config.authEnabled ? "Configured" : "Not configured"}</dd></div><div><dt>Sign-in</dt><dd>{config.emulatorHost ? "Local Auth emulator" : config.authEnabled ? "Firebase" : "Not configured"}</dd></div><div><dt>Gemini assistant</dt><dd>{config.aiEnabled ? "Configured" : "Disabled"}</dd></div><div><dt>WhatsApp (optional)</dt><dd>{channel?.connection?.active ? config.outboundEnabled ? "Configured" : "Configured; sending paused" : "Not connected"}</dd></div></dl></section><details className="panel"><summary>Optional WhatsApp connection</summary><p>You can use the web assistant, contacts, orders and approvals without connecting WhatsApp.</p><Link className="text-link" href="/messages">View optional WhatsApp settings</Link></details>{business && <PrivacyControls />}<p className="stage-note">Manual orders, sales, confirmed receipts and approvals are available after workspace creation. The web assistant works independently; WhatsApp setup is optional.</p></>;
}
