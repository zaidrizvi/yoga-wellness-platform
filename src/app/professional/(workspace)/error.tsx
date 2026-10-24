"use client";
export default function ProfessionalError({ reset }: { reset: () => void }) { return <section className="account-panel"><h2>We couldn’t load your workspace.</h2><p>Please try again. No action has been confirmed by this screen.</p><button type="button" className="text-link" onClick={reset}>Try again</button></section>; }
