import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";

export type ProgramBenefit = { icon: LucideIcon; title: string; description: string };
export type ProgramStep = { title: string; description: string };

const ACCENT_CTA = "w-full bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 sm:w-auto";

/**
 * Shared landing for the partner programmes (agents, affiliates, hotels,
 * venues). `eyebrow`, `icon` and each benefit's `icon` stay on the props for
 * callers but are not rendered: the title already names the programme, and a
 * tile per benefit read as decoration.
 */
export function ProgramLanding({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  benefits,
  steps,
  faqNote,
  loginHref,
  image,
}: {
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  benefits: ProgramBenefit[];
  steps: ProgramStep[];
  faqNote?: string;
  /** For programs with a dedicated portal login (e.g. /agent/login) — shows an "already registered" link. */
  loginHref?: string;
  /** Photo shown under the hero call to action. */
  image?: { src: string; alt: string };
}) {
  return (
    <div>
      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className={ACCENT_CTA} render={<Link href={ctaHref} />}>
              {ctaLabel} <ArrowRight aria-hidden />
            </Button>
            {loginHref ? (
              <Button size="lg" variant="outline" className="w-full bg-card sm:w-auto" render={<Link href={loginHref} />}>
                Agent portal login
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="w-full bg-card sm:w-auto" render={<Link href="/signup" />}>
                Create a free account
              </Button>
            )}
          </div>
          {image ? (
            <div className="relative mx-auto mt-12 aspect-video w-full max-w-4xl overflow-hidden rounded-2xl shadow-xl ring-1 ring-foreground/10">
              <Image src={image.src} alt={image.alt} fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Why partner with STS" />
          <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <li key={b.title} className="bg-card p-6">
                <h3 className="font-heading text-base font-bold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/30 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="How it works" />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground tabular-nums"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-base font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <SectionHeading title="Ready to apply?" lead={faqNote} />
          <Button size="lg" className={`mt-8 ${ACCENT_CTA}`} render={<Link href={ctaHref} />}>
            {ctaLabel} <ArrowRight aria-hidden />
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">No setup fees to apply.</p>
        </div>
      </section>
    </div>
  );
}
