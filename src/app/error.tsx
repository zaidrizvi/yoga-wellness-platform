"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="shell account-shell"><p className="eyebrow">A brief pause</p><h1>Temporarily unavailable.</h1><p>We could not load this information. Please try again in a moment.</p><Button onClick={reset}>Try again</Button><p><Link className="text-link" href="/">Return home</Link></p></section>;
}
