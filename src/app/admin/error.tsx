"use client";
export default function AdminError({reset}:{reset:()=>void}){return <section className="account-panel"><h2>Administration is temporarily unavailable.</h2><p>Reload to check the current state before repeating an action.</p><button type="button" className="text-link" onClick={reset}>Try again</button></section>;}
