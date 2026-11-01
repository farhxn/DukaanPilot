import Link from "next/link";
import { currentIdentity } from "@/server/auth/session";
import { getBusiness } from "@/server/domain/business";
import { getDb } from "@/server/db";
import { getServerConfig } from "@/server/config";
import { AssistantForm } from "@/components/assistant-form";
export default async function AssistantPage() {
  const identity = await currentIdentity(), business = identity ? await getBusiness(getDb(), identity) : null;
  return <><div className="page-heading"><div><h1>Your business assistant</h1><p>A draft first. Your approval before anything is saved.</p></div></div>{identity && business ? <AssistantForm enabled={getServerConfig().aiEnabled} /> : <section className="panel section-empty"><h2>Open your business workspace first.</h2><Link className="button button-dark" href={identity ? "/setup" : "/login"}>{identity ? "Set up workspace" : "Sign in"}</Link></section>}</>;
}
