import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { requireUser } from "@/lib/auth/session";
import { getApplicationForWizard } from "@/modules/visa/queries";
import { getServerTrpc } from "@/lib/trpc/server";
import { TRAVELER_DOCUMENT_TYPES } from "@/modules/travelers/schemas";
import { countryName } from "@/lib/countries";
import { VisaTypeBanner } from "@/modules/visa/components/visa-shared";
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
  await requireUser();
  const trpc = await getServerTrpc();

  const application = await getApplicationForWizard(applicationId);
  if (!application || !application.visa_type) notFound();
  if (application.status !== "draft") redirect(`/account/visa/${application.id}`);

  const maxStep = Math.min(Math.max(application.current_step, 1), 5);
  const requested = Number.parseInt(stepParam ?? "1", 10) || 1;
  const step = Math.min(Math.max(requested, 1), maxStep);

  const visaType = application.visa_type;
  const destination = countryName(visaType.destination_country_code);

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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MarketingBreadcrumb
        className="mb-4"
        items={[
          { label: "Visa", href: "/visa" },
          { label: destination, href: `/visa/${visaType.id}` },
          { label: "Apply" },
        ]}
      />

      <VisaTypeBanner visaType={visaType} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <WizardStepper applicationId={application.id} currentStep={step} maxStep={maxStep} />

        {/* A <section>, not <main>: the marketing layout already owns <main>. */}
        <section aria-label="Application step" className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-7">
          {step === 1 ? (
            <StepApplicantType application={application} backHref={`/visa/${visaType.id}`} />
          ) : step === 2 ? (
            <StepPersonalInfo application={application} />
          ) : step === 3 ? (
            <StepTravelInfo application={application} destination={destination} />
          ) : step === 4 ? (
            <StepDocuments application={application} vaultOptions={vaultOptions} />
          ) : (
            <StepReview application={application} />
          )}
        </section>
      </div>
    </div>
  );
}
