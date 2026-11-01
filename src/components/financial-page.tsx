import Link from "next/link";
import { currentIdentity } from "@/server/auth/session";
import { getBusiness } from "@/server/domain/business";
import { getDb } from "@/server/db";
import { BusinessWorkbench } from "./business-workbench";
import { getServerConfig } from "@/server/config";

export async function FinancialPage({ section }: { section: "orders" | "ledger" | "approvals" }) {
  const identity = await currentIdentity(), business = identity ? await getBusiness(getDb(), identity) : null;
  const title = section === "orders" ? "Orders" : section === "ledger" ? "Ledger & udhaar" : "Approvals";
  return <><div className="page-heading"><div><h1>{title}</h1><p>{section === "orders" ? "Every commitment, with a clear due date." : section === "ledger" ? "Sales, receipts, and outstanding balances kept distinct." : "Your review. Your decision. A record you can trust."}</p></div></div>{!identity ? <section className="panel section-empty"><h2>Sign in to your workspace.</h2><p>Your business records are private.</p><Link className="button button-dark" href="/login">Sign in</Link></section> : !business ? <section className="panel section-empty"><h2>Create your business first.</h2><Link className="button button-dark" href="/setup">Set up workspace</Link></section> : <BusinessWorkbench key={section} section={section} whatsappEnabled={getServerConfig().outboundEnabled} followUpEnabled={getServerConfig().followUpEnabled} />}</>;
}
