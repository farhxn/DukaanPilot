import Link from "next/link";
import { currentIdentity } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { getBusiness } from "@/server/domain/business";
import { ChannelWorkbench } from "@/components/channel-workbench";
export default async function MessagesPage() {
  const identity = await currentIdentity(), business = identity ? await getBusiness(getDb(), identity) : null;
  return <><div className="page-heading"><div><h1>WhatsApp & messages</h1><p>Your customers’ requests, owner controls, and delivery status.</p></div></div>{identity && business ? <ChannelWorkbench /> : <section className="panel section-empty"><h2>Open your workspace to see private messages.</h2><Link className="button button-dark" href={identity ? "/setup" : "/login"}>{identity ? "Set up workspace" : "Sign in"}</Link></section>}</>;
}
