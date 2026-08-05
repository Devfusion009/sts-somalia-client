import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getApplicationForWizard } from "@/modules/visa/queries";
import { countryName } from "@/lib/countries";
import { VisaTypeBanner } from "@/modules/visa/components/visa-shared";
import { WizardStepper } from "@/modules/visa/components/wizard-stepper";
import { ApplicationSummary } from "@/modules/visa/components/application-summary";
import {
  StepApplicantType,
  StepPersonalInfo,
  StepTravelInfo,
  StepDocuments,
  StepReview,
} from "@/modules/visa/components/steps";

export const metadata: Metadata = { title: "Visa Application" };

export default async function VisaWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ applicationId }, { step: stepParam }] = await Promise.all([params, searchParams]);
  await requireUser();

  const application = await getApplicationForWizard(applicationId);
  if (!application || !application.visa_type) notFound();
  if (application.status !== "draft") redirect(`/account/visa/${application.id}`);

  const maxStep = Math.min(Math.max(application.current_step, 1), 5);
  const requested = Number.parseInt(stepParam ?? "1", 10) || 1;
  const step = Math.min(Math.max(requested, 1), maxStep);

  const visaType = application.visa_type;
  const destination = countryName(visaType.destination_country_code);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/visa" className="hover:text-foreground">
          Visa
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`/visa/${visaType.id}`} className="hover:text-foreground">
          {destination}
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">Apply</span>
      </nav>

      <VisaTypeBanner visaType={visaType} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[270px_1fr] xl:grid-cols-[270px_1fr_310px]">
        <WizardStepper applicationId={application.id} currentStep={step} maxStep={maxStep} />

        <main className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
          {step === 1 ? (
            <StepApplicantType application={application} backHref={`/visa/${visaType.id}`} />
          ) : step === 2 ? (
            <StepPersonalInfo application={application} />
          ) : step === 3 ? (
            <StepTravelInfo application={application} destination={destination} />
          ) : step === 4 ? (
            <StepDocuments application={application} />
          ) : (
            <StepReview application={application} />
          )}
        </main>

        <div className="hidden xl:block">
          <ApplicationSummary application={application} priceLabel="Price From" />
        </div>
      </div>
    </div>
  );
}
