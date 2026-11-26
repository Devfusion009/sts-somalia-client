import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Headset,
  AlertTriangle,
  Plane,
  Building2,
  UserCheck,
  Briefcase,
  Wallet,
  FileText,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/session";
import { APP_CONFIG, stepsFor, stepLabel, docSlotsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import { getDocumentReviews, getEditableApplication, wizardStep } from "@/modules/partner-applications/queries";
import { unconfirmedDraftStep } from "@/modules/partner-applications/draft-fields";
import { getApplicationDrafts } from "@/modules/partner-applications/drafts";
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
import { LogoUploadField } from "@/modules/partner-applications/components/logo-upload-field";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Partner Application" };

function isKind(value: string): value is ApplicationKind {
  return value === "agency" || value === "hotel_partner" || value === "affiliate" || value === "venue_partner";
}

function article(label: string): string {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

const STEP_ICONS: Record<number, LucideIcon> = {
  1: Building2,
  2: UserCheck,
  3: Briefcase,
  4: Wallet,
  5: FileText,
  6: ClipboardCheck,
};

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

  const drafts = await getApplicationDrafts(type, id);
  const draftApplication = { ...application, drafts, draftOwner: user.id };
  const validSteps = stepsFor(type);
  const maxStep = Math.min(Math.max(wizardStep(application.business_details), 1), 6);

  if (!stepParam) {
    const unfinished = unconfirmedDraftStep(drafts);
    const resumeStep = unfinished && unfinished <= maxStep ? unfinished : validSteps.includes(maxStep) ? maxStep : validSteps[validSteps.length - 1];
    redirect(`/account/become/${type}/${id}?step=${resumeStep}`);
  }

  const requested = Number.parseInt(stepParam, 10) || validSteps[0];
  const step = validSteps.includes(requested) && requested <= maxStep ? requested : Math.min(maxStep, validSteps[validSteps.length - 1]);

  // Partial edits must be validated before review; never silently submit an
  // older confirmed version while the latest draft contains different data.
  const unconfirmed=unconfirmedDraftStep(drafts);
  if (step >= 5 && unconfirmed) redirect(`/account/become/${type}/${id}?step=${unconfirmed}`);

  const cfg = APP_CONFIG[type];

  // Only step 5 renders review state, and an applicant who never had a
  // document rejected has no rows to read — so this stays off the other five
  // steps rather than being fetched alongside the application every time.
  const documentReviews = step === 5 ? await getDocumentReviews(type, id) : {};
  const StepIcon = STEP_ICONS[step] ?? Building2;
  const requiredDocs = docSlotsFor(type).filter((slot) => !slot.optional);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 220"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 size-full text-primary"
        >
          <path
            d="M -20 200 C 140 60, 340 230, 560 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="1 11"
            strokeLinecap="round"
            opacity="0.4"
          />
          <circle cx="-20" cy="200" r="4" fill="currentColor" opacity="0.35" />
          <circle cx="330" cy="150" r="3.5" fill="currentColor" opacity="0.3" />
        </svg>
        <Plane className="pointer-events-none absolute top-[26%] right-[26%] size-6 rotate-[-28deg] text-primary opacity-60 sm:size-7" />

        <Link
          href="/account/become"
          aria-label="Back to Become a Partner"
          className="absolute top-6 left-6 z-10 inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 sm:top-8 sm:left-8"
        >
          <ArrowLeft className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </Link>

        <div className="relative flex items-center justify-between gap-4 pt-10">
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
            Want to Become {article(cfg.label)} {cfg.label}?
          </h1>
          <span className="hidden shrink-0 rounded-2xl bg-white p-3 shadow-xs sm:block">
            <Image src="/marketing/travel-agent-illustration.webp" alt="" width={220} height={129} className="w-36 lg:w-52" priority />
          </span>
        </div>
      </div>

      {application.status === "more_info_requested" && application.review_notes ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle />
          <AlertTitle>Message from STS</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6 lg:order-2">
          <WizardStepper kind={type} applicationId={id} currentStep={step} maxStep={maxStep} />

          {requiredDocs.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <p className="text-sm font-semibold">Required documents</p>
              <ul className="mt-3 space-y-2.5">
                {requiredDocs.map((slot) => (
                  <li key={slot.key} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {slot.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-secondary/50 p-5">
            <p className="text-sm font-semibold">Need help?</p>
            <Button variant="outline" className="mt-3 w-full" render={<a href="tel:+252611444420" />}>
              <Headset data-icon="inline-start" aria-hidden="true" /> Call support
            </Button>
          </div>
        </div>

        <main className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7 lg:order-1">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <StepIcon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="font-heading text-lg font-semibold">{stepLabel(type, step)}</h2>
          </div>
          {step === 1 ? (
            <>
              {type !== "affiliate" ? (
                <div className="mb-5 space-y-1.5">
                  <Label>Organization logo</Label>
                  <LogoUploadField
                    kind={type}
                    applicationId={application.id}
                    logoPath={typeof application.business_details?.logoPath === "string" ? application.business_details.logoPath : null}
                  />
                  <Separator className="mt-4" />
                </div>
              ) : null}
              <StepBusiness kind={type} application={draftApplication} backHref="/account/become" />
            </>
          ) : step === 2 ? (
            <StepContact kind={type} application={draftApplication} />
          ) : step === 3 ? (
            <StepOperations kind={type} application={draftApplication} />
          ) : step === 4 ? (
            <StepSettlement kind={type} application={draftApplication} />
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
