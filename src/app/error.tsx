"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="panel section-empty" role="alert"><h1>Something interrupted this page.</h1><p>Please try again. No financial entry has been made by this preview.</p><button type="button" className="button button-dark" onClick={reset}>Try again</button></section>;
}
