import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { getVisaTypeById, getResolvedVisaPricing } from "@/modules/visa/queries";
import { parseDocumentSlots } from "@/modules/visa/schemas";
import { DELIVERY_MODE_LABELS } from "@/modules/visa/workflow";
import { countryName } from "@/lib/countries";
import { fmtMoneyExact, processingText } from "@/modules/visa/components/visa-shared";
import { VisaExpertCard } from "@/components/marketing/visa-expert-card";
import { VisaOverview } from "@/modules/visa/components/detail/visa-overview";
import { DocumentArt, STEP_ART, VisaArtDefs } from "@/modules/visa/components/detail/visa-art";
import { visaCardImage } from "@/modules/visa/images";
import {
  MobileBookingBar,
  VisaBookingSummary,
  type VisaFeeLine,
} from "@/modules/visa/components/detail/visa-booking-summary";
import { Badge } from "@/components/ui/badge";

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
    text: "Complete the guided online form for yourself, your family or a group.",
  },
  {
    title: "Upload documents",
    text: "Attach clear copies of the required documents as PDF, JPG or PNG.",
  },
  {
    title: "Pay",
    text: "Card, mobile money or bank transfer.",
  },
  {
    title: "We handle the rest",
    text: "Our visa desk reviews every document, submits the application and you follow each step in your account.",
  },
];

const ASSURANCES = [
  "Documents checked before they reach the consulate",
  "Status tracking in your account",
  "Family and group applications together",
];

const CATEGORY_LABEL: Record<string, string> = {
  tourist: "Tourist visa",
  business: "Business visa",
  transit: "Transit visa",
  umrah: "Umrah visa",
  work: "Work visa",
  student: "Student visa",
  family_visit: "Family visit visa",
};

const REQUIREMENTS_ID = "visa-documents";

export default async function VisaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nationality?: string }>;
}) {
  const { id } = await params;
  const { nationality: rawNationality } = await searchParams;
  const chosenNationality =
    rawNationality && /^[A-Za-z]{2}$/.test(rawNationality) && countryName(rawNationality.toUpperCase()) !== rawNationality.toUpperCase()
      ? rawNationality.toUpperCase()
      : null;
  const visa = await getVisaTypeById(id);
  if (!visa) notFound();
  // A passport from the destination country itself is never valid; ignore it.
  const nationality =
    chosenNationality && chosenNationality !== visa.destination_country_code.toUpperCase() ? chosenNationality : null;

  // A chosen passport prices the page through resolve_visa_pricing, the same
  // function the application freezes its quote from, so this preview never
  // differs from what is charged.
  const resolved = nationality ? await getResolvedVisaPricing(visa.id, nationality) : null;
  const price = Number(resolved?.price ?? visa.price);
  const processingFee = Number(resolved?.processing_fee ?? visa.processing_fee ?? 0);
  const slots = parseDocumentSlots(resolved?.required_documents ?? visa.required_documents);
  const destinationCode = visa.destination_country_code.toUpperCase();
  const destination = countryName(destinationCode);
  const fees: VisaFeeLine[] = [
    { label: "Visa fee", amount: price },
    ...(processingFee > 0 ? [{ label: "Processing fee", amount: processingFee }] : []),
  ];
  const total = fees.reduce((sum, line) => sum + line.amount, 0);
  const category = [
    CATEGORY_LABEL[visa.visa_category] ?? "Visa",
    visa.entry_type === "multiple" ? "Multiple entry" : "Single entry",
  ].join(", ");

  const facts = [
    { label: "Visa type", value: category },
    { label: "Appointment", value: visa.requires_appointment ? "Required" : "Not required" },
    { label: "Biometrics", value: visa.requires_biometrics ? "Required" : "Not required" },
    { label: "Original passport", value: visa.requires_physical_passport ? "Required" : "Not required" },
    ...(visa.requires_physical_passport && visa.passport_delivery_modes?.length
      ? [
          {
            label: "Passport return",
            value: visa.passport_delivery_modes.map((mode) => DELIVERY_MODE_LABELS[mode] ?? mode).join(", "),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <VisaArtDefs />
      <MarketingBreadcrumb className="mb-5" items={[{ label: "Visa", href: "/visa" }, { label: destination }]} />

      <VisaOverview
        visaName={visa.name}
        overview={visa.overview ?? visa.description ?? null}
        destinationCode={destinationCode}
        nationality={nationality}
        requirementsId={REQUIREMENTS_ID}
        coverImage={visaCardImage(visa)}
        metrics={[
          { key: "processing", label: "Processing time", value: processingText(visa) },
          { key: "validity", label: "Validity", value: visa.validity_days ? `${visa.validity_days} days` : "Varies" },
          { key: "stay", label: "Max stay", value: visa.stay_days ? `${visa.stay_days} days` : "Varies" },
          {
            key: "price",
            label: nationality ? "Price for you" : "Starting price",
            value: fmtMoneyExact(total, visa.currency),
            live: true,
          },
        ]}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby={REQUIREMENTS_ID}>
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id={REQUIREMENTS_ID}
                tabIndex={-1}
                className="scroll-mt-28 font-heading text-2xl font-bold tracking-tight outline-none sm:text-[1.75rem]"
              >
                Required documents
              </h2>
              {nationality ? (
                <Badge variant="neutral">For {countryName(nationality)} passports</Badge>
              ) : null}
            </div>
            {slots.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Confirmed by our visa desk after you apply.</p>
            ) : (
              <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {slots.map((slot) => (
                  <li
                    key={slot.key}
                    className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),white_82%),color-mix(in_oklch,var(--primary),white_92%)_55%,color-mix(in_oklch,var(--brand-gold),white_85%))] ring-1 ring-primary/15 max-sm:h-24 max-sm:w-28">
                      <DocumentArt label={slot.label} />
                    </div>
                    <div className="min-w-0 py-0.5">
                      <h3 className="flex flex-wrap items-center gap-2 text-base font-bold">
                        {slot.label}
                        <Badge variant={slot.required ? "success" : "neutral"} className="font-medium">
                          {slot.required ? "Required" : "Optional"}
                        </Badge>
                      </h3>
                      {slot.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{slot.description}</p>
                      ) : null}
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Check className="size-3.5 text-primary" aria-hidden />
                        PDF, JPG or PNG{slot.max_mb ? `, up to ${slot.max_mb} MB` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="visa-how">
            <h2 id="visa-how" className="font-heading text-2xl font-bold tracking-tight sm:text-[1.75rem]">
              How it works
            </h2>
            <ol className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {HOW_IT_WORKS.map((item, i) => {
                const Art = STEP_ART[i];
                return (
                  <li
                    key={item.title}
                    className="relative flex flex-col rounded-2xl border border-border bg-card p-3 pb-5 text-left shadow-xs"
                  >
                    <div className="relative h-36 w-full overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_15%,color-mix(in_oklch,var(--primary),white_80%),color-mix(in_oklch,var(--primary),white_93%)_60%,color-mix(in_oklch,var(--brand-gold),white_88%))] ring-1 ring-primary/10">
                      <Art className="p-2" />
                      <span
                        className="absolute top-2.5 left-2.5 grid size-8 place-items-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground tabular-nums shadow-sm ring-4 ring-white/70"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 px-2 text-base font-bold">
                      <span className="sr-only">Step {i + 1}: </span>
                      {item.title}
                    </h3>
                    <p className="mt-1.5 px-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                    {i < HOW_IT_WORKS.length - 1 ? (
                      <span
                        aria-hidden
                        className="absolute top-[4.5rem] -right-[1.15rem] z-10 hidden size-7 place-items-center rounded-full border border-border bg-card text-primary shadow-sm xl:grid"
                      >
                        <ChevronRight className="size-4" strokeWidth={2.5} />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="visa-info">
            <h2 id="visa-info" className="font-heading text-2xl font-bold tracking-tight sm:text-[1.75rem]">
              Additional information
            </h2>
            <dl className="mt-5 grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div
                  key={fact.label}
                  className={`flex items-baseline justify-between gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-border" : ""} ${
                    i === 1 ? "sm:border-t-0 sm:border-l" : i % 2 === 1 ? "sm:border-l" : ""
                  }`}
                >
                  <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                  <dd className="text-right text-sm font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {visa.eligibility_requirements ? (
              <div className="mt-6">
                <h3 className="text-base font-bold">Eligibility</h3>
                <p className="mt-2 leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {visa.eligibility_requirements}
                </p>
              </div>
            ) : null}

            {visa.terms_and_conditions ? (
              <details className="group mt-6 rounded-xl border border-border bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  Terms and conditions
                  <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="border-t border-border px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {visa.terms_and_conditions}
                </p>
              </details>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Booking">
          <VisaBookingSummary
            id="apply"
            visaId={visa.id}
            visaName={visa.name}
            category={category}
            destinationCode={destinationCode}
            currency={visa.currency}
            fees={fees}
            nationality={nationality}
            assurances={ASSURANCES}
          />
          <VisaExpertCard visaName={visa.name} />
        </aside>
      </div>

      {/* Phones: room for the bottom booking bar, so it never covers the last content. */}
      <div className="h-24 lg:hidden" aria-hidden />
      <MobileBookingBar visaId={visa.id} nationality={nationality} currency={visa.currency} total={total} />
    </div>
  );
}
