import type { Metadata } from "next";
import { getReapplyCredit } from "@/modules/visa/queries";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
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

export const metadata: Metadata = { title: "Visa Application — Agent Desk" };

/**
 * Desk-portal wizard host — same steps, same server actions as the public
 * wizard (modules/visa/components/steps.tsx, modules/visa/actions.ts), just
 * a different host and every step form carrying desk="1". Kept in lockstep
 * with (marketing)/visa/apply/[applicationId]/page.tsx deliberately: that
 * page is not forked, only re-hosted — see advanceWizard() in actions.ts for
 * why a second host page (rather than a redirect to the public one) is
 * required at all.
 *
 * No vault reuse here (unlike the public host): the document vault belongs
 * to whichever profile is signed in, which for a desk session is the agent,
 * not the agency_customer this application is actually for.
 */
export default async function AgentVisaWizardPage({
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
  if (!application.agency_id) notFound();
  if (application.status !== "draft") redirect("/agent/bookings?type=visa");

  const maxStep = Math.min(Math.max(application.current_step, 1), 5);
  const requested = Number.parseInt(stepParam ?? "1", 10) || 1;
  const step = Math.min(Math.max(requested, 1), maxStep);

  const visaType = application.visa_type;
  const destination = countryName(visaType.destination_country_code);

  return (
    <div className="space-y-6">
      <Link
        href="/agent/book/visa"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" /> Visa
      </Link>

      <VisaTypeBanner visaType={visaType} />

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <WizardStepper
          applicationId={application.id}
          currentStep={step}
          maxStep={maxStep}
          basePath="/agent/book/visa/apply"
        />

        <section aria-label="Application step" className="@container/visa-form min-w-0 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/[0.08] sm:p-7">
          {step === 1 ? (
            <StepApplicantType application={application} backHref="/agent/book/visa" desk />
          ) : step === 2 ? (
            <StepPersonalInfo application={application} desk />
          ) : step === 3 ? (
            <StepTravelInfo application={application} destination={destination} desk />
          ) : step === 4 ? (
            <StepDocuments application={application} vaultOptions={[]} desk />
          ) : (
            <StepReview application={application} desk credit={step >= 5 ? await getReapplyCredit(application) : null} />
          )}
        </section>

        <div className="min-w-0 lg:col-start-2 2xl:col-start-auto 2xl:sticky 2xl:top-24">
          <ApplicationSummary application={application} priceLabel="Price" />
        </div>
      </div>
    </div>
  );
}
