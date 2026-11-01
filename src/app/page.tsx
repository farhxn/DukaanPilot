import Link from "next/link";
import { ArrowRightIcon, ArrowTopRightIcon, ReaderIcon, FileTextIcon, PersonIcon, ChatBubbleIcon, CheckIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { currentIdentity } from "@/server/auth/session";
import { getBusiness } from "@/server/domain/business";
import { dashboard } from "@/server/domain/reports";
import { getDb } from "@/server/db";
import { getServerConfig } from "@/server/config";
import { formatPkr } from "@/lib/money";

const metrics = [
  { label: "Recorded sales", helper: "Today’s posted sales", icon: ReaderIcon },
  { label: "Money received", helper: "Today’s confirmed collections", icon: FileTextIcon },
  { label: "Outstanding udhaar", helper: "Across your customers", icon: PersonIcon },
  { label: "Pending orders", helper: "Waiting to be fulfilled", icon: ReaderIcon },
];

export default async function OverviewPage() {
  const config = getServerConfig();
  const identity = await currentIdentity();
  const business = identity ? await getBusiness(getDb(), identity) : null;
  const summary = identity && business ? await dashboard(getDb(), identity) : null;
  const values = summary ? [formatPkr(summary.salesPaisa), formatPkr(summary.collectionsPaisa), formatPkr(summary.outstandingPaisa), summary.pendingOrders.toString()] : null;
  return (
    <>
      <div className="page-heading"><div><h1>{business ? `${business.name}, at a glance.` : "A fresh start for your business."}</h1><p>Sab kuch ek jagah. Your orders, customers, and hisaab.</p></div><Link href="/setup" className="button button-dark">{business ? "Business settings" : "Set up workspace"} <ArrowRightIcon /></Link></div>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy"><span className="welcome-eyebrow"><span className="small-line" /> YOUR EVERYDAY BUSINESS COMPANION</span><h2 id="welcome-title">Less to remember.<br />More room to grow.</h2><p>Keep track of what’s sold, what’s owed, and what needs your attention. One small step at a time.</p><Link href="/assistant" className="button button-light">Use AI assistant <ArrowRightIcon /></Link></div>
        <div className="welcome-checklist"><span className="checklist-label">A simpler working day</span><div><span className="check-circle"><CheckIcon /></span><span>Orders that don’t get lost</span></div><div><span className="check-circle"><CheckIcon /></span><span>Udhaar you can keep track of</span></div><div><span className="check-circle"><CheckIcon /></span><span>Every financial action, approved by you</span></div><span className="checklist-footnote">Your business tools, ready in your browser</span></div>
      </section>
      <section aria-label="Business overview" className="metrics-grid">
        {metrics.map(({ label, helper, icon: Icon }, index) => <article className="metric" key={label}><div className="metric-label">{label}<Icon /></div><div className="metric-value" aria-label={values ? undefined : "Not available"}>{values?.[index] ?? "—"}</div><div className="metric-description">{helper}</div></article>)}
      </section>
      <p className="data-note"><InfoMarker />{summary ? "Totals come from posted records. Sales and owner-confirmed receipts are separate." : "No financial data yet. Sign in and create your workspace to start recording."}</p>
      {summary && <section className="panel daily-summary"><div className="panel-heading"><h2>Today’s summary</h2><Link href="/approvals" className="text-link">{summary.pendingApprovals} awaiting review <ArrowRightIcon /></Link></div><p>{summary.summary}</p></section>}
      <div className="overview-grid">
        <section className="panel getting-started" aria-labelledby="getting-started-title"><div className="panel-heading"><h2 id="getting-started-title">Make yourself at home</h2><span className="subtle-badge">Getting started</span></div><p className="panel-description">A little setup now. A clearer picture every day.</p>
          <Link href="/setup" className="setup-step"><span className="step-number">01</span><div><h3>Your business, your workspace</h3><p>See what’s needed to bring your dukaan online.</p></div><ArrowRightIcon /></Link>
          <Link href="/customers" className="setup-step"><span className="step-number">02</span><div><h3>Get to know your customer space</h3><p>A home for contacts and their order history.</p></div><ArrowRightIcon /></Link>
          <Link href="/ledger" className="setup-step"><span className="step-number">03</span><div><h3>Understand your hisaab</h3><p>Keep sales, money received, and udhaar distinct.</p></div><ArrowRightIcon /></Link>
        </section>
        <section className="assistant-panel" aria-labelledby="assistant-title"><span className="assistant-icon"><ChatBubbleIcon /></span><div className="assistant-title-row"><h2 id="assistant-title">Meet your AI Munshi</h2><span className="subtle-badge">{config.aiEnabled ? "Available" : "Manual tools available"}</span></div><p>Speak your business’s language. Turn everyday instructions into a clear preview, right here in the web app.</p><div className="example-message"><span>Example instruction</span><blockquote>“Ali ko 650 rupay ka samaan diya,<br className="desktop-break" /> udhaar hai.”</blockquote><span className="message-language">Roman Urdu, Urdu & English</span></div><Link href="/assistant" className="button button-dark">Open business assistant <ArrowRightIcon /></Link><div className="approval-note"><LockClosedIcon /><span>You review. You approve.<br /><strong>Nothing financial is saved automatically.</strong></span></div></section>
      </div>
      <section className="panel activity-panel" aria-labelledby="activity-title"><div className="panel-heading"><h2 id="activity-title">Recent activity</h2><Link className="text-link" href="/approvals">View approvals <ArrowTopRightIcon /></Link></div>{summary?.recent.length ? <div className="recent-records">{summary.recent.map(entry => <div key={entry.id}><span><strong>{entry.customerName}</strong><small>{entry.kind.replaceAll("_", " ")}</small></span><strong>{formatPkr(entry.amountPaisa)}</strong></div>)}</div> : <div className="activity-empty"><span className="empty-icon"><ReaderIcon /></span><div><h3>A clean page, ready for your business.</h3><p>Posted sales, receipts, and corrections will appear here.</p></div></div>}</section>
    </>
  );
}

function InfoMarker() { return <span className="info-marker" aria-hidden="true">i</span>; }
