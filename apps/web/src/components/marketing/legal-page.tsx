import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";

export type LegalSection = { title: string; body: string; list?: string[] };

/** Shared layout for the public legal pages (terms, privacy, partner terms). */
export function LegalPage({
  title,
  meta,
  sections,
}: {
  title: string;
  /** "Last updated …" and any scope line, shown under the title. */
  meta: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <MarketingBreadcrumb className="mb-6" items={[{ label: title }]} />
      <header className="border-b border-border pb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{meta}</p>
      </header>
      <div className="divide-y divide-border">
        {sections.map((section) => (
          <section key={section.title} className="py-6">
            <h2 className="font-heading text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{section.body}</p>
            {section.list ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
