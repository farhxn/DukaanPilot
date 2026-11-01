import Link from "next/link";
import { currentIdentity } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { getBusiness } from "@/server/domain/business";
import { Directory } from "./directory";
export async function DirectoryPage({ kind }: { kind: "customers" | "suppliers" }) {
  const title = kind === "customers" ? "Customers" : "Suppliers";
  const identity = await currentIdentity();
  const business = identity ? await getBusiness(getDb(), identity) : null;
  return <><div className="page-heading"><div><h1>{title}</h1><p>{kind === "customers" ? "Familiar people. Clear contact records." : "The people who keep your business supplied."}</p></div>{business && <span className="subtle-badge">{business.name}</span>}</div>{!identity ? <section className="panel section-empty"><h2>Sign in to your workspace.</h2><p>Your contacts are private to your business. Sign in before viewing or adding records.</p><Link href="/login" className="button button-dark">Sign in</Link></section> : !business ? <section className="panel section-empty"><h2>Create your business first.</h2><p>Set up your workspace before adding customer or supplier contacts.</p><Link href="/setup" className="button button-dark">Set up workspace</Link></section> : <Directory kind={kind} />}</>;
}
