import { CalendarDays, CheckCircle2, Clock3, ListOrdered, Mail, Phone, ScrollText } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { LegalToc, type LegalTocItem } from "@/components/marketing/legal-toc";
import { SUPPORT_PHONE_DISPLAY } from "@/lib/marketing-nav";

export type LegalSection = { title: string; body: string; list?: string[] };

const SUPPORT_EMAIL = "info@scoutsts.com";

/** "3. Visa services" -> { number: "3", title: "Visa services" }; unnumbered titles are numbered by position. */
function splitTitle(title: string, index: number): { number: string; title: string } {
  const match = /^(\d+)\.\s+(.*)$/.exec(title);
  return match ? { number: match[1], title: match[2] } : { number: String(index + 1), title };
}

/** Pulls "Last updated: …" out of the meta line so it can stand on its own. */
function splitMeta(meta: string): { scope: string | null; updated: string | null } {
  const match = /Last updated:?\s*([^.]+)\.?/i.exec(meta);
  const scope = meta.replace(match?.[0] ?? "", "").trim();
  return { scope: scope || null, updated: match?.[1]?.trim() ?? null };
}

function readingMinutes(sections: LegalSection[]): number {
  const words = sections
    .flatMap((s) => [s.title, s.body, ...(s.list ?? [])])
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

/** Shared layout for the public legal pages (terms, privacy, partner terms). */
export function LegalPage({
  title,
  meta,
  sections,
  audience,
}: {
  title: string;
  /** "Last updated …" and any scope line, shown under the title. */
  meta: string;
  sections: LegalSection[];
  /** Who the document binds, shown as tags in the header. */
  audience?: string[];
}) {
  const { scope, updated } = splitMeta(meta);
  const items: LegalTocItem[] = sections.map((section, i) => {
    const { number, title: name } = splitTitle(section.title, i);
    return { id: `section-${number}`, number, title: name };
  });

  return (
    <article>
      <header className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_90%_at_100%_0%,rgba(0,148,124,0.35),transparent_70%),radial-gradient(40%_60%_at_0%_100%,rgba(244,113,28,0.12),transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent)] bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px]"
        />
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <MarketingBreadcrumb tone="dark" items={[{ label: title }]} />
          <p className="mt-10 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">
            <ScrollText className="size-4" aria-hidden />
            Legal
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {scope ? <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{scope}</p> : null}

          {audience?.length ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {audience.map((who) => (
                <li
                  key={who}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/15"
                >
                  <CheckCircle2 className="size-3.5 text-teal-300" aria-hidden />
                  {who}
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm text-white/70">
            {updated ? (
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-teal-300" aria-hidden />
                <dt>Last updated</dt>
                <dd className="font-semibold text-white">{updated}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <ListOrdered className="size-4 text-teal-300" aria-hidden />
              <dt className="sr-only">Sections</dt>
              <dd>
                <span className="font-semibold text-white tabular-nums">{sections.length}</span> sections
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-teal-300" aria-hidden />
              <dt className="sr-only">Reading time</dt>
              <dd>
                <span className="font-semibold text-white tabular-nums">{readingMinutes(sections)}</span> min read
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
          <LegalToc items={items} />

          <div className="min-w-0 space-y-4">
            {sections.map((section, i) => {
              const item = items[i];
              return (
                <section
                  key={item.id}
                  id={item.id}
                  aria-labelledby={`${item.id}-title`}
                  className="scroll-mt-32 rounded-2xl border border-border bg-card p-6 shadow-xs transition-colors hover:border-primary/30 sm:p-8"
                >
                  <div className="flex items-start gap-4 sm:gap-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-heading text-sm font-bold text-primary tabular-nums">
                      {item.number.padStart(2, "0")}
                    </span>
                    <div className="min-w-0 pt-1.5">
                      <h2 id={`${item.id}-title`} className="font-heading text-xl font-semibold tracking-tight text-balance">
                        {item.title}
                      </h2>
                      <p className="mt-3 leading-relaxed text-muted-foreground">{section.body}</p>
                      {section.list ? (
                        <ul className="mt-4 space-y-2.5">
                          {section.list.map((entry) => (
                            <li key={entry} className="flex gap-3 leading-relaxed text-muted-foreground">
                              <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                              <span>{entry}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </section>
              );
            })}

            <aside className="relative isolate mt-8 overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-foreground sm:p-8">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-[radial-gradient(60%_100%_at_100%_0%,rgba(0,148,124,0.35),transparent_70%)]"
              />
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">Questions about these terms?</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-sidebar transition-colors hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <Phone className="size-4" aria-hidden />
                  <span className="tabular-nums">{SUPPORT_PHONE_DISPLAY}</span>
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <Mail className="size-4" aria-hidden />
                  {SUPPORT_EMAIL}
                </a>
                <WhatsAppInlineLink
                  message={`Hello STS, I have a question about the ${title.toLowerCase()}.`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/15"
                >
                  WhatsApp
                </WhatsAppInlineLink>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </article>
  );
}
