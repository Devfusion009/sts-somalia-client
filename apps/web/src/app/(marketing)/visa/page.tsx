import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Globe, Headset, ShieldCheck, Timer, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getVisaTypes } from "@/modules/visa/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { visaCardImage } from "@/modules/visa/images";
import { destinationOptions, matchesDestination } from "@/modules/visa/search";
import { VisaDestinationSearch } from "@/components/marketing/visa-destination-search";
import { VisaRequirementBadge } from "@/modules/visa/components/visa-requirement-badge";
import { VisaHeroBanner, VisaProcess } from "@/components/marketing/visa-hero";
import { VisaExpertCard } from "@/components/marketing/visa-expert-card";
import { ReviewsRail } from "@/components/marketing/reviews-rail";
import { HomeFaq } from "@/components/marketing/home-faq";
import { SectionHeading } from "@/components/marketing/section-heading";

export const metadata: Metadata = { title: "Visa Services" };

const VISA_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "What documents do I need?",
    answer:
      "It depends on your destination and nationality. Once you pick a visa on this page, the exact document checklist for your case is shown before you start the application.",
  },
  {
    question: "How long does processing take?",
    answer:
      "Processing time is set per destination and shown on that visa's page before you apply. Our desk reviews your documents before they are submitted.",
  },
  {
    question: "Can I apply for my family or a group in one application?",
    answer:
      "Yes — an application can cover a single traveller, a family, or a group, with each person's details entered once and tracked together.",
  },
  {
    question: "What happens if a document I upload gets rejected?",
    answer:
      "Our desk flags exactly which document and why. You upload a replacement and review continues from there — the rest of your application stays as submitted.",
  },
  {
    question: "Can I track my application after I submit it?",
    answer: "Yes, from your account — status updates as our desk and the consulate move your case forward.",
  },
  {
    question: "Are visa fees refundable?",
    answer: "No. All visa fees are non-refundable once submitted, regardless of the consulate's decision.",
  },
];

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Document review before submission" },
  { icon: Timer, text: "Application tracking in your account" },
  { icon: Users, text: "Family and group applications" },
];

const WHY_US = [
  { icon: ShieldCheck, text: "Documents checked before they reach the consulate" },
  { icon: Timer, text: "Status tracking on every application" },
  { icon: Users, text: "Family and group applications handled together" },
  { icon: Wallet, text: "Local payment methods — EVC Plus, bank, card" },
  { icon: Headset, text: "24/7 support from our Mogadishu-based team" },
];

export default async function VisaListPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; from?: string }>;
}) {
  const { country, from } = await searchParams;
  // The traveller's passport country, picked in the hero search. Unknown codes are ignored.
  const passport = from && /^[A-Za-z]{2}$/.test(from) && countryName(from.toUpperCase()) !== from.toUpperCase() ? from.toUpperCase() : null;
  const visaHref = (id: string) => (passport ? `/visa/${id}?nationality=${passport}` : `/visa/${id}`);
  const allVisaTypes = await getVisaTypes();
  const destinations = destinationOptions(allVisaTypes);
  const visaTypes = country
    ? allVisaTypes.filter((v) => matchesDestination(v.destination_country_code, country))
    : allVisaTypes;
  const featured = !country ? visaTypes.filter((v) => v.is_featured) : [];

  return (
    <div>
      <VisaHeroBanner>
        <div className="max-w-2xl">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
            Visa applications, <span className="text-brand-accent">checked before they&apos;re submitted</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/85 drop-shadow">
            Our desk reviews every document against what the consulate requires, then tracks your
            case to a decision.
          </p>

          <VisaDestinationSearch destinations={destinations} defaultValue={country} defaultPassport={passport} />

          <ul className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {TRUST_POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-2 text-sm font-medium text-white/85 drop-shadow">
                <point.icon className="size-4 shrink-0 text-primary" aria-hidden /> {point.text}
              </li>
            ))}
          </ul>
        </div>
      </VisaHeroBanner>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        {featured.length > 0 ? (
          <section aria-labelledby="visa-popular">
            <div id="visa-popular">
              <SectionHeading align="left" title="Popular destinations" />
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
              {featured.map((visa) => {
                const photo = visaCardImage(visa);
                return (
                  <li key={visa.id}>
                    <Link
                      href={visaHref(visa.id)}
                      className="group block rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
                        {photo ? (
                          <Image
                            src={photo}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                            unoptimized={!photo.startsWith("/")}
                            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                          />
                        ) : (
                          <span className="text-5xl leading-none sm:text-6xl" aria-hidden>
                            {countryFlag(visa.destination_country_code)}
                          </span>
                        )}
                        {photo ? (
                          <span
                            className="absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-background text-lg leading-none shadow-md"
                            aria-hidden
                          >
                            {countryFlag(visa.destination_country_code)}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 font-heading text-base leading-snug font-bold transition-colors group-hover:text-primary">
                        {countryName(visa.destination_country_code)}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-xs text-muted-foreground">{processingText(visa)}</span>
                        <span className="font-heading text-base font-bold text-foreground tabular-nums sm:text-lg">
                          {fmtMoney(visa.price, visa.currency)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section id="visa-results" aria-labelledby="visa-results-heading" className="scroll-mt-48">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="visa-results-heading" className="font-heading text-2xl font-bold tracking-tight">
              {country ? `Visas for “${country}”` : "All visa services"}
            </h2>
            {visaTypes.length > 0 ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                {visaTypes.length} visa{visaTypes.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          {visaTypes.length > 0 ? (
            <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {visaTypes.map((visa) => (
                <li key={visa.id}>
                  <Card className="h-full py-0 transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 p-5 sm:flex-row sm:items-start">
                      <span className="text-3xl leading-none" aria-hidden>
                        {countryFlag(visa.destination_country_code)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {countryName(visa.destination_country_code)}
                        </p>
                        <h3 className="font-heading text-base font-bold">
                          <Link
                            href={visaHref(visa.id)}
                            className="rounded-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {visa.name}
                          </Link>
                        </h3>
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                          <div className="flex gap-1">
                            <dt>Processing</dt>
                            <dd className="font-medium text-foreground">{processingText(visa)}</dd>
                          </div>
                          {visa.validity_days ? (
                            <div className="flex gap-1">
                              <dt>Validity</dt>
                              <dd className="font-medium text-foreground">{visa.validity_days} days</dd>
                            </div>
                          ) : null}
                          {visa.stay_days ? (
                            <div className="flex gap-1">
                              <dt>Stay</dt>
                              <dd className="font-medium text-foreground">{visa.stay_days} days</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="sr-only">Entry</dt>
                            <dd>{visa.entry_type === "multiple" ? "Multiple entry" : "Single entry"}</dd>
                          </div>
                        </dl>
                        <div className="mt-2.5">
                          {passport ? (
                            <VisaRequirementBadge
                              destinationCountryName={countryName(visa.destination_country_code)}
                              nationalityCode={passport}
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-3 border-t border-border pt-4 sm:block sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                        <p>
                          <span className="block text-xs text-muted-foreground">From</span>
                          <span className="font-heading text-lg font-bold text-primary tabular-nums">
                            {fmtMoney(visa.price, visa.currency)}
                          </span>
                        </p>
                        <Button className="gap-1 sm:mt-2" render={<Link href={visaHref(visa.id)} />}>
                          Apply <ArrowRight className="size-3.5" aria-hidden />
                          <span className="sr-only">for {visa.name}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="mt-6 border border-border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Globe />
                </EmptyMedia>
                <EmptyTitle className="text-base">
                  No visa services{country ? ` for “${country}”` : ""}
                </EmptyTitle>
              </EmptyHeader>
              {country ? (
                <EmptyContent>
                  <Button variant="outline" render={<Link href="/visa" />}>
                    View all visa services
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          )}
        </section>
      </div>

      <VisaProcess />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <VisaExpertCard wide />
      </div>

      <section className="border-t border-border bg-background py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Why book your visa with STS" />
          <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {WHY_US.map((point) => (
              <li key={point.text} className="flex items-center gap-3 sm:flex-col sm:text-center">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
                  <point.icon className="size-5" />
                </span>
                <p className="text-sm leading-snug text-muted-foreground">{point.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ReviewsRail />
      <HomeFaq faqs={VISA_FAQS} title="Visa questions" />
    </div>
  );
}
