import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, ReaderIcon, PersonIcon, FileTextIcon, CheckCircledIcon, BarChartIcon, GearIcon, LockClosedIcon } from "@radix-ui/react-icons";

const sections = {
  orders: { title: "Orders", subtitle: "Every commitment, in one place.", heading: "Your next order starts here.", description: "Keep track of what customers asked for, when it’s due, and what still needs your attention.", icon: ReaderIcon, facts: ["Clear due dates", "Owner-approved commitments", "Bounded order follow-ups"], note: "Order entry will be available after business setup and the approval workflow are implemented. An order will never create a sale automatically." },
  customers: { title: "Customers", subtitle: "Good business starts with familiar people.", heading: "A place for every customer.", description: "Find the right Ali, remember the last order, and keep each customer’s records together.", icon: PersonIcon, facts: ["Searchable customer contacts", "Separate customer histories", "Clear outstanding balances"], note: "Customer entry and search are the next data foundation. No customer names or phone numbers are stored in this preview." },
  ledger: { title: "Ledger & udhaar", subtitle: "A clearer hisaab. Fewer loose ends.", heading: "Your business records start with trust.", description: "See what you’ve sold, what you’ve received, and what’s still owed. Always as separate numbers.", icon: FileTextIcon, facts: ["Exact amounts in PKR", "Partial repayments", "Corrections with a visible history"], note: "Financial recording is not available yet. Every future sale, payment, and correction will require your explicit approval." },
  approvals: { title: "Approvals", subtitle: "You stay in control of your business.", heading: "Your say, before it’s saved.", description: "Review the customer, amount, and action in a clear preview. Edit, reject, or approve when you’re ready.", icon: CheckCircledIcon, facts: ["Review the exact amount", "Edit before approval", "No automatic financial writes"], note: "There are no proposals to review. Approval controls arrive with the deterministic business services, before AI integration." },
  usage: { title: "Usage", subtitle: "Useful assistance. Clear limits.", heading: "No AI usage to report.", description: "Your AI allowance and provider costs will be shown here once the assistant is connected and usage tracking is ready.", icon: BarChartIcon, facts: ["Finite usage allowances", "Visible provider costs", "Manual entry when AI is unavailable"], note: "Gemini is disabled. WhatsApp is disconnected. No plan has been activated and no paid API calls are made by this application." },
  setup: { title: "Workspace setup", subtitle: "A good foundation for your everyday business.", heading: "Let’s build your business workspace.", description: "The dashboard foundation is ready. Sign-in, your business profile, and tenant-isolated records are the next development stage.", icon: GearIcon, facts: ["One business, one owner", "PKR · Asia/Karachi", "Private business records"], note: "This preview has no sign-in or data storage yet. No account, business profile, or provider connection is created by visiting this page." },
};

type Section = keyof typeof sections;
function isSection(value: string): value is Section { return Object.hasOwn(sections, value); }

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return { title: isSection(section) ? sections[section].title : "Page not found" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const page = sections[section];
  const Icon = page.icon;
  return <><div className="page-heading"><div><h1>{page.title}</h1><p>{page.subtitle}</p></div><span className="subtle-badge page-stage">Workspace foundation</span></div><section className="panel section-empty"><span className="section-empty-icon"><Icon /></span><h2>{page.heading}</h2><p>{page.description}</p><div className="future-facts">{page.facts.map(fact => <span key={fact}>{fact}</span>)}</div><Link href={section === "setup" ? "/" : "/setup"} className="button button-dark">{section === "setup" ? "Back to overview" : "See workspace setup"}<ArrowRightIcon /></Link></section><aside className="stage-note"><LockClosedIcon /><p>{page.note}</p></aside>{section === "setup" && <section className="panel setup-status"><h2>Connection status</h2><dl><div><dt>Business account</dt><dd>Not created</dd></div><div><dt>Record storage</dt><dd>Not connected</dd></div><div><dt>Gemini assistant</dt><dd>Disabled</dd></div><div><dt>WhatsApp</dt><dd>Not connected</dd></div></dl></section>}</>;
}
