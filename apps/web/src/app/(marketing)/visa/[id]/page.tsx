import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, ChevronRight, FileCheck2 } from "lucide-react";
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
  { title: "Application details" },
  { title: "Document upload" },
  { title: "Payment" },
  { title: "Review & submission" },
];

const ASSURANCES = ["Document review", "Application tracking", "Family and group applications"];

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

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-8 xl:gap-12">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby={REQUIREMENTS_ID}>
            <div className="flex flex-wrap items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary/8 text-primary"><FileCheck2 className="size-4.5" aria-hidden /></span>
              <h2
                id={REQUIREMENTS_ID}
                tabIndex={-1}
                className="scroll-mt-28 font-heading text-2xl font-semibold tracking-tight outline-none sm:text-[1.75rem]"
              >
                Required documents
              </h2>
              {nationality ? (
                <Badge variant="neutral">For {countryName(nationality)} passports</Badge>
              ) : null}
            </div>
            {slots.length === 0 ? (
              <p className="mt-4 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Document checklist pending.</p>
            ) : (
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {slots.map((slot) => (
                  <li
                    key={slot.key}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
                  >
                    <div className="relative flex h-36 items-center justify-center border-b border-border/70 bg-[#edf3ef] bg-[linear-gradient(45deg,transparent_49.5%,#dce7df_50%,transparent_50.5%)] bg-[size:24px_24px]">
                      <DocumentArt label={slot.label} className="max-w-48 p-3 transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-5">
                      <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                        {slot.label}
                        <Badge variant={slot.required ? "success" : "neutral"} className="ml-auto text-[10px] font-medium">
                          {slot.required ? "Required" : "Optional"}
                        </Badge>
                      </h3>
                      {slot.description ? (
                        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{slot.description}</div>
                      ) : null}
                      <p className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[11px] font-medium text-muted-foreground">
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
            <h2 id="visa-how" className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              How it works
            </h2>
            <ol className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {HOW_IT_WORKS.map((item, i) => {
                const Art = STEP_ART[i];
                return (
                  <li
                    key={item.title}
                    className="relative flex flex-col text-left"
                  >
                    <div className="relative h-32 w-full overflow-hidden rounded-2xl border border-border bg-[#edf3ef]">
                      <Art className="p-2" />
                      <span
                        className="absolute top-2 left-2 font-mono text-[11px] font-medium text-primary/75"
                        aria-hidden
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">
                      <span className="sr-only">Step {i + 1}: </span>
                      {item.title}
                    </h3>
                    {i < HOW_IT_WORKS.length - 1 ? (
                      <span
                        aria-hidden
                        className="absolute top-14 -right-3 z-10 hidden size-5 place-items-center rounded-full border border-border bg-card text-primary xl:grid"
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
            <h2 id="visa-info" className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
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

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Booking">
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
