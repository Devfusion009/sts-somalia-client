import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { APP_CONFIG, stepsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import { getEditableApplication, wizardStep } from "@/modules/partner-applications/queries";
import { WizardStepper } from "@/modules/partner-applications/components/wizard-stepper";
import {
  StepBusiness,
  StepContact,
  StepOperations,
  StepSettlement,
  StepDocuments,
  StepReview,
} from "@/modules/partner-applications/components/steps";

export const metadata: Metadata = { title: "Partner Application" };

function isKind(value: string): value is ApplicationKind {
  return value === "agency" || value === "hotel_partner" || value === "affiliate" || value === "venue_partner";
}

export default async function PartnerApplicationWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ type, id }, { step: stepParam }] = await Promise.all([params, searchParams]);
  if (!isKind(type)) notFound();

  const user = await requireUser();
  const { application } = await getEditableApplication(type, id, user.id);
  if (!application) notFound();

  const validSteps = stepsFor(type);
  const maxStep = Math.min(Math.max(wizardStep(application.business_details), 1), 6);

  if (!stepParam) {
    const resumeStep = validSteps.includes(maxStep) ? maxStep : validSteps[validSteps.length - 1];
    redirect(`/account/become/${type}/${id}?step=${resumeStep}`);
  }

  const requested = Number.parseInt(stepParam, 10) || validSteps[0];
  const step = validSteps.includes(requested) && requested <= maxStep ? requested : Math.min(maxStep, validSteps[validSteps.length - 1]);

  const cfg = APP_CONFIG[type];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/account/become" className="hover:text-foreground">
          Become a Partner
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{cfg.label}</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold">{cfg.label} Application</h1>
        <p className="text-sm text-muted-foreground">Complete every step, then submit for review.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        <WizardStepper kind={type} applicationId={id} currentStep={step} maxStep={maxStep} />

        <main className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
          {step === 1 ? (
            <StepBusiness kind={type} application={application} backHref="/account/become" />
          ) : step === 2 ? (
            <StepContact kind={type} application={application} />
          ) : step === 3 ? (
            <StepOperations kind={type} application={application} />
          ) : step === 4 ? (
            <StepSettlement kind={type} application={application} />
          ) : step === 5 ? (
            <StepDocuments kind={type} application={application} />
          ) : (
            <StepReview kind={type} application={application} />
          )}
        </main>
      </div>
    </div>
  );
}
