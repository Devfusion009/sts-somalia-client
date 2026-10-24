import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, ShieldCheck, Timer, Users } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { getVisaTypeById, getResolvedVisaPricing } from "@/modules/visa/queries";
import { startVisaApplication } from "@/modules/visa/actions";
import { parseDocumentSlots } from "@/modules/visa/schemas";
import { countryFlag, countryName, NATIONALITY_DEFAULT } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { SubmitButton } from "@/components/submit-button";
import { VisaExpertCard } from "@/components/marketing/visa-expert-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const visa = await getVisaTypeById(id);
  return { title: visa?.name ?? "Visa Service" };
}

const HOW_IT_WORKS = [
  {
    title: "Fill the application",
    text: "Complete the guided online form — for yourself, your family, or a group.",
  },
  {
    title: "Upload documents",
    text: "Attach clear scans of the required documents; our team reviews every file.",
  },
  {
    title: "Pay",
    text: "Card, mobile money or bank transfer.",
  },
  {
    title: "We handle the rest",
    text: "STS submits to the immigration authority and you track progress in your account.",
  },
];

const SIDEBAR_ASSURANCES = [
  { icon: ShieldCheck, text: "Documents checked before they reach the consulate" },
  { icon: Timer, text: "Status tracking in your account" },
  { icon: Users, text: "Family and group applications handled together" },
];

export default async function VisaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nationality?: string }>;
}) {
  const { id } = await params;
  const { nationality } = await searchParams;
  const visa = await getVisaTypeById(id);
  if (!visa) notFound();

  // A nationality in the URL means the customer chose it before seeing a
  // price — resolve_visa_pricing is the same function the wizard freezes a
  // snapshot from later, so this preview can never quote a different number
  // than what they're actually charged.
  const resolved = nationality ? await getResolvedVisaPricing(visa.id, nationality) : null;
  const price = resolved?.price ?? visa.price;
  const processingFee = resolved?.processing_fee ?? visa.processing_fee;
  const slots = parseDocumentSlots(resolved?.required_documents ?? visa.required_documents);
  const destination = countryName(visa.destination_country_code);
  const total = Number(price) + Number(processingFee ?? 0);

  const specRows = [
    { label: "Processing time", value: processingText(visa) },
    { label: "Validity", value: visa.validity_days ? `${visa.validity_days} days` : "Varies" },
    { label: "Max stay", value: visa.stay_days ? `${visa.stay_days} days` : "Varies" },
    { label: nationality ? "Price for you" : "Starting price", value: fmtMoney(price, visa.currency) },
  ];
  const overview = visa.overview ?? visa.description;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MarketingBreadcrumb className="mb-4" items={[{ label: "Visa", href: "/visa" }, { label: destination }]} />

      <header className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <span className="text-base leading-none" aria-hidden>
              {countryFlag(NATIONALITY_DEFAULT)}
            </span>
            <ArrowRight className="size-3.5 text-primary" aria-hidden />
            <span className="text-base leading-none" aria-hidden>
              {countryFlag(visa.destination_country_code)}
            </span>
            <span className="text-sm font-semibold">{destination}</span>
          </div>
          <Badge variant="success">Licensed Somali travel agency</Badge>
        </div>

        <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">{visa.name}</h1>
        {overview ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{overview}</p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {specRows.map((row) => (
            <div key={row.label} className="bg-secondary/40 px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>

        {/* Nationality decides the price and the document list. */}
        <form className="mt-6 grid gap-3 border-t border-border pt-6 sm:grid-cols-[minmax(0,22rem)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="nationality-select">Your passport nationality</Label>
            <CountrySearchSelect
              id="nationality-select"
              name="nationality"
              defaultValue={nationality}
              placeholder="Search for a country"
            />
          </div>
          <Button type="submit" variant="outline" size="lg">
            See price and requirements
          </Button>
        </form>

        {/* Phones: the price card sits after every section below. */}
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-secondary/40 p-4 lg:hidden">
          <p className="min-w-0">
            <span className="block text-xs text-muted-foreground">{nationality ? "Total for you" : "Total from"}</span>
            <span className="font-heading text-xl font-bold text-primary tabular-nums">
              {fmtMoney(total, visa.currency)}
            </span>
          </p>
          <Button render={<a href="#apply" />} size="lg" className="shrink-0">
            Apply now
          </Button>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-12">
          {visa.eligibility_requirements ? (
            <section aria-labelledby="visa-eligibility">
              <h2 id="visa-eligibility" className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
                Eligibility requirements
              </h2>
              <p className="mt-3 leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {visa.eligibility_requirements}
              </p>
            </section>
          ) : null}

          <section aria-labelledby="visa-documents">
            <h2 id="visa-documents" className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
              Required documents
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {slots.map((slot) => (
                <li key={slot.key} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">
                      {slot.label}
                      {!slot.required ? (
                        <span className="font-normal text-muted-foreground"> (optional)</span>
                      ) : null}
                    </p>
                    {slot.description ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{slot.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="visa-how">
            <h2 id="visa-how" className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
              How it works
            </h2>
            <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((item, i) => (
                <li key={item.title} className="rounded-xl border border-border bg-card p-4">
                  <span
                    className="flex size-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground tabular-nums"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section
            id="apply"
            aria-labelledby="visa-price"
            className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl leading-none" aria-hidden>
                {countryFlag(visa.destination_country_code)}
              </span>
              <h2 id="visa-price" className="font-heading text-base font-bold">
                {visa.name}
              </h2>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Government and service fee</dt>
                <dd className="font-semibold tabular-nums">{fmtMoney(price, visa.currency)}</dd>
              </div>
              {Number(processingFee) > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Processing fee</dt>
                  <dd className="font-semibold tabular-nums">{fmtMoney(processingFee!, visa.currency)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm font-semibold">{nationality ? "Total for you" : "Total from"}</span>
              <span className="font-heading text-3xl font-bold text-primary tabular-nums">
                {fmtMoney(total, visa.currency)}
              </span>
            </div>

            <form action={startVisaApplication} className="mt-5">
              <input type="hidden" name="visaTypeId" value={visa.id} />
              {nationality ? <input type="hidden" name="nationality" value={nationality} /> : null}
              <SubmitButton size="lg" className="w-full gap-2" pendingText="Starting application…">
                Apply now <ArrowRight className="size-4" aria-hidden />
              </SubmitButton>
            </form>

            <ul className="mt-5 space-y-2.5 border-t border-border pt-4">
              {SIDEBAR_ASSURANCES.map((item) => (
                <li key={item.text} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {item.text}
                </li>
              ))}
            </ul>
          </section>

          <VisaExpertCard visaName={visa.name} />
        </aside>
      </div>
    </div>
  );
}
