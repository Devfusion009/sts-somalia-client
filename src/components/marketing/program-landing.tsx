import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ProgramBenefit = { icon: LucideIcon; title: string; description: string };
export type ProgramStep = { title: string; description: string };

export function ProgramLanding({
  eyebrow,
  icon: HeroIcon,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  benefits,
  steps,
  faqNote,
  loginHref,
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
  /** For programs with a dedicated portal login (e.g. /agent/login) — shows an "already registered" link instead of the generic apply-then-login copy. */
  loginHref?: string;
}) {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <HeroIcon className="size-7" />
          </span>
          <Badge variant="secondary" className="mt-6">
            {eyebrow}
          </Badge>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90" render={<Link href={ctaHref} />}>
              {ctaLabel} <ArrowRight />
            </Button>
            {!loginHref && (
              <Button size="lg" variant="outline" render={<Link href="/signup" />}>
                Create a free account
              </Button>
            )}
          </div>
          {loginHref ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Already an approved agent?{" "}
              <Link href={loginHref} className="font-medium text-primary hover:underline">
                Log in to the Agent Portal
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Already have an account? You&apos;ll be asked to log in, then land right back here to apply.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold">Why partner with STS Somalia</h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <Card key={b.title}>
              <CardContent className="flex flex-col items-start gap-3 p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <b.icon className="size-5" />
                </span>
                <h3 className="font-heading text-base font-semibold">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-secondary/40 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-semibold">How it works</h2>
          </div>
          <ol className="mt-10 space-y-6">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-semibold">Ready to get started?</h2>
        <p className="mt-3 text-muted-foreground">
          Applications are reviewed by our team, usually within a couple of business days.
          {faqNote ? ` ${faqNote}` : ""}
        </p>
        <div className="mt-6 flex items-center justify-center">
          <Button size="lg" className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90" render={<Link href={ctaHref} />}>
            {ctaLabel} <ArrowRight />
          </Button>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5" /> No setup fees to apply
        </p>
      </section>
    </div>
  );
}
