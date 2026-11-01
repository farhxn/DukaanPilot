import Link from "next/link";
export default function NotFound() {
  return <section className="panel section-empty"><span className="subtle-badge">404</span><h1>We couldn’t find that page.</h1><p>Head back to your workspace to pick up where you left off.</p><Link href="/" className="button button-dark">Back to overview</Link></section>;
}
