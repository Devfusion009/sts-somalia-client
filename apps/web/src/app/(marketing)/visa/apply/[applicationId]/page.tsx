import type { Metadata } from "next";
import { getReapplyCredit } from "@/modules/visa/queries";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { requireUser } from "@/lib/auth/session";
import { getApplicationForWizard } from "@/modules/visa/queries";
import { getServerTrpc } from "@/lib/trpc/server";
import { TRAVELER_DOCUMENT_TYPES } from "@/modules/travelers/schemas";
import { countryFlag, countryName } from "@/lib/countries";
import { visaCardImage } from "@/modules/visa/images";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { WizardStepper } from "@/modules/visa/components/wizard-stepper";
import {
  StepApplicantType,
  StepPersonalInfo,
  StepTravelInfo,
  StepDocuments,
  StepReview,
} from "@/modules/visa/components/steps";

export const metadata: Metadata = { title: "Visa Application" };

const VAULT_TYPE_LABELS = new Map(TRAVELER_DOCUMENT_TYPES.map((t) => [t.value, t.label]));

export default async function VisaWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ applicationId }, { step: stepParam }] = await Promise.all([params, searchParams]);
  await requireUser(`/visa/apply/${applicationId}`);
  const trpc = await getServerTrpc();

  const application = await getApplicationForWizard(applicationId);
  if (!application || !application.visa_type) notFound();
  if (application.status !== "draft") redirect(`/account/visa/${application.id}`);

  const maxStep = Math.min(Math.max(application.current_step, 1), 5);
  const requested = Number.parseInt(stepParam ?? "1", 10) || 1;
  const step = Math.min(Math.max(requested, 1), maxStep);

  const visaType = application.visa_type;
  const destination = countryName(visaType.destination_country_code);
  const cover = visaCardImage(visaType);

  // Only the document step offers vault reuse, so only that step pays for the
  // query. Every other step would be loading a list nothing renders.
  // Reuse is a convenience on top of uploading fresh files, not a dependency
  // of the step itself — if the API is unreachable, fall back to no saved
  // documents rather than taking the whole wizard down.
  let vaultOptions: {
    id: string;
    label: string;
    fileName: string;
    documentType: string;
  }[] = [];
  if (step === 4) {
    try {
      const documents = await trpc.travelers.myDocuments.query();
      vaultOptions = documents.map((doc) => ({
        id: doc.id,
        label:
          doc.label ??
          `${VAULT_TYPE_LABELS.get(doc.document_type) ?? "Document"}${
            doc.traveler ? ` — ${doc.traveler.full_name}` : ""
          }`,
        fileName: doc.file_name,
        documentType: doc.document_type,
      }));
    } catch {
      vaultOptions = [];
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <MarketingBreadcrumb
        className="mb-4"
        items={[
          { label: "Visa", href: "/visa" },
          { label: destination, href: `/visa/${visaType.id}` },
          { label: "Apply" },
        ]}
      />

      <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#073c34] text-white">
        {cover ? (
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-[42%] sm:block" aria-hidden="true">
            <Image src={cover} alt="" fill sizes="(min-width: 1024px) 480px, 42vw" unoptimized={!cover.startsWith("/")} className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-r from-[#073c34] via-[#073c34]/50 to-[#073c34]/10" />
          </div>
        ) : null}
        <div className="px-6 py-7 sm:p-9">
          <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.2em] text-[#a8dec9] uppercase">
            <span className="h-px w-6 bg-[#eaa16f]" aria-hidden="true" /> Visa application
          </div>
          <div className="mt-4 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl" aria-hidden="true">{countryFlag(visaType.destination_country_code)}</span>
            <h1 className="max-w-xl self-center font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">{visaType.name}</h1>
          </div>
          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-5 border-t border-white/15 pt-5 sm:max-w-[70%]">
            <div><dt className="text-xs text-white/60">Processing time</dt><dd className="mt-1 text-sm font-semibold">{processingText(visaType)}</dd></div>
            {visaType.validity_days ? <div><dt className="text-xs text-white/60">Validity</dt><dd className="mt-1 text-sm font-semibold">{visaType.validity_days} days</dd></div> : null}
            {visaType.stay_days ? <div><dt className="text-xs text-white/60">Stay period</dt><dd className="mt-1 text-sm font-semibold">{visaType.stay_days} days</dd></div> : null}
            <div><dt className="text-xs text-white/60">Price from</dt><dd className="mt-1 text-sm font-semibold text-[#a8dec9]">{fmtMoney(visaType.price, visaType.currency)}</dd></div>
          </dl>
        </div>
      </header>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-5 lg:sticky lg:top-24">
          <WizardStepper applicationId={application.id} currentStep={step} maxStep={maxStep} />
          <div className="hidden rounded-2xl border border-border bg-secondary/40 p-5 lg:block">
            <span className="flex items-center gap-2 text-xs font-medium text-primary"><ShieldCheck className="size-4" aria-hidden="true" /> STS visa desk</span>
            <a href="tel:+252611444420" className="mt-3 flex items-center justify-between gap-2 rounded-sm text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">+252 611 444 420 <ArrowUpRight className="size-4" aria-hidden="true" /></a>
          </div>
        </div>

        {/* A <section>, not <main>: the marketing layout already owns <main>. */}
        <section aria-label="Application step" className="@container/visa-form min-w-0 rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_12px_36px_-24px_rgba(7,60,52,0.2)] sm:p-8 lg:p-9">
          {step === 1 ? (
            <StepApplicantType application={application} backHref={`/visa/${visaType.id}`} />
          ) : step === 2 ? (
            <StepPersonalInfo application={application} />
          ) : step === 3 ? (
            <StepTravelInfo application={application} destination={destination} />
          ) : step === 4 ? (
            <StepDocuments application={application} vaultOptions={vaultOptions} />
          ) : (
            <StepReview application={application} credit={step >= 5 ? await getReapplyCredit(application) : null} />
          )}
        </section>
      </div>
    </div>
  );
}
