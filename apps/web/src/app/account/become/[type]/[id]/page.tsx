import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Headset, ArrowRight, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/session";
import { APP_CONFIG, stepsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import { getDocumentReviews, getEditableApplication, wizardStep } from "@/modules/partner-applications/queries";
import { WizardStepper } from "@/modules/partner-applications/components/wizard-stepper";
import { Button } from "@/components/ui/button";
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
  // Covers both "not yours" and "past the edit window" — the read-only view
  // resolves the first as a 404 of its own, and is the right destination for
  // the second rather than a dead end on a bookmarked wizard URL.
  const { application } = await getEditableApplication(type, id, user.id);
  if (!application) redirect(`/account/become/${type}/${id}/view`);

  const validSteps = stepsFor(type);
  const maxStep = Math.min(Math.max(wizardStep(application.business_details), 1), 6);

  if (!stepParam) {
    const resumeStep = validSteps.includes(maxStep) ? maxStep : validSteps[validSteps.length - 1];
    redirect(`/account/become/${type}/${id}?step=${resumeStep}`);
  }

  const requested = Number.parseInt(stepParam, 10) || validSteps[0];
  const step = validSteps.includes(requested) && requested <= maxStep ? requested : Math.min(maxStep, validSteps[validSteps.length - 1]);

  const cfg = APP_CONFIG[type];

  // Only step 5 renders review state, and an applicant who never had a
  // document rejected has no rows to read — so this stays off the other five
  // steps rather than being fetched alongside the application every time.
  const documentReviews = step === 5 ? await getDocumentReviews(type, id) : {};

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/account/become" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Become a Partner
        </Link>
        <h1 className="font-heading text-2xl font-semibold">{cfg.label} Application</h1>
      </div>

      {application.status === "more_info_requested" && application.review_notes ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle />
          <AlertTitle>Action needed from STS</AlertTitle>
          <AlertDescription>{application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        <div className="space-y-6">
          <WizardStepper kind={type} applicationId={id} currentStep={step} maxStep={maxStep} />
          <div className="rounded-2xl border border-border bg-secondary/50 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Headset className="size-4 text-primary" /> Need help?
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Our support team is here to assist you.</p>
            <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5" render={<a href="tel:+252611444420" />}>
              Contact Support <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>

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
            <StepDocuments kind={type} application={application} reviews={documentReviews} />
          ) : (
            <StepReview kind={type} application={application} />
          )}
        </main>
      </div>
    </div>
  );
}
