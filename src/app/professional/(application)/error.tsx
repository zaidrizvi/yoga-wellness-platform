"use client";
export default function ApplicationError({reset}:{reset:()=>void}){return <section className="account-panel"><h2>Your application is temporarily unavailable.</h2><p>Reload to check its current status before repeating a save, upload or submission.</p><button className="text-link" type="button" onClick={reset}>Try again</button></section>;}
