import Link from "next/link";
import { currentIdentity } from "@/server/auth/session";
import { getBusiness } from "@/server/domain/business";
import { getDb } from "@/server/db";
import { usage } from "@/server/ai/metering";
import { getServerConfig } from "@/server/config";
export default async function UsagePage() {
  const identity = await currentIdentity(), business = identity ? await getBusiness(getDb(), identity) : null;
  const data = identity && business ? await usage(getDb(), identity) : null;
  return <><div className="page-heading"><div><h1>Usage</h1><p>Clear limits. Your records remain available.</p></div></div>{data ? <section className="panel financial-editor"><h2>{data.plan.toLowerCase()} pilot plan</h2><p>AI assistant: {getServerConfig().aiEnabled ? "Configured" : "Disconnected"}</p><dl className="preview-values"><div><dt>AI actions this month ({data.month}, UTC)</dt><dd>{data.monthlyUsed} / {data.monthly}</dd></div><div><dt>Today ({data.day}, Pakistan)</dt><dd>{data.dailyUsed} / {data.daily}</dd></div><div><dt>Instructions being checked</dt><dd>{data.reserved}</dd></div><div><dt>Concurrent follow-up limit</dt><dd>{data.workflows}</dd></div></dl>{data.warning && <p className="form-notice" role="status">You have used at least 80% of your monthly allowance.</p>}<p>Manual entry, approvals, summaries and export use no AI actions. One completed instruction uses one action, including a clarification. Internal spending caps can stop AI before this allowance.</p><p className="form-hint">Pilot tiers and prices are proposals. This app does not collect subscription payments or apply automatic overage charges.</p><Link className="button button-outline" href="/ledger">Open manual entry</Link></section> : <section className="panel section-empty"><h2>Sign in and create your workspace to see usage.</h2><Link className="button button-dark" href={identity ? "/setup" : "/login"}>{identity ? "Set up workspace" : "Sign in"}</Link></section>}</>;
}
