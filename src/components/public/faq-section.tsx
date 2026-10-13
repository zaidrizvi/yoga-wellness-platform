import type { FaqItem } from "@/content/services";

export function FaqSection({ items, title = "A little clarity,", emphasis = "before you begin.", intro = "Thoughtful answers for a thoughtful start." }: { items: readonly FaqItem[]; title?: string; emphasis?: string; intro?: string }) {
  return <section id="faq" className="faq-section section-space" aria-labelledby="faq-title"><div className="shell faq-layout"><div><p className="eyebrow">A few things to know</p><h2 id="faq-title">{title}<br /><em>{emphasis}</em></h2><p className="faq-intro">{intro}</p></div><div className="faq-list">{items.map((faq) => <details key={faq.question}><summary>{faq.question}<span className="faq-plus" aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></div></section>;
}
