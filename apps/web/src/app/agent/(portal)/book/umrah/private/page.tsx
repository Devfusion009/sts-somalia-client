import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, Calculator, CalendarDays, RotateCcw, UsersRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { getMyDraftUmrahRequest } from "@/modules/umrah/custom-queries";
import { startUmrahCustomRequest } from "@/modules/umrah/custom-actions";
import { UMRAH_TIER_LABELS } from "@/modules/umrah/services";
import { formatMoney, tripDurationDays } from "@/modules/umrah/pricing";

export const metadata: Metadata = { title: "Build a private Umrah" };

/**
 * Agent-portal entry point for the private Umrah builder. Thin by design —
 * the actual wizard is the shared step components, hosted here under
 * `/agent/book/umrah/private` via the `desk` flag each step's form carries
 * (see wizardBasePath() in custom-actions.ts) so its redirects never bounce
 * an agent out to the B2C marketing route.
 */
export default async function AgentPrivateUmrahLauncherPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) redirect("/agent");

  const draft = await getMyDraftUmrahRequest();

  return (
    <div className="space-y-6">
      <BackLink href="/agent/book/umrah" label="Umrah" />

      <h1 className="font-heading text-2xl font-bold">Build a private Umrah</h1>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Could not start the trip. Try again.</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        {draft ? (
          <>
            <Badge className="border-transparent bg-primary/10 text-primary">
              <RotateCcw className="size-3.5" /> Draft in progress
            </Badge>
            <p className="mt-3 font-heading text-lg font-bold">
              {UMRAH_TIER_LABELS[draft.tier]} · {draft.num_pilgrims} traveller
              {draft.num_pilgrims > 1 ? "s" : ""}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {draft.nights_makkah + draft.nights_madinah > 0 ? (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-primary" />
                  {tripDurationDays({
                    numPilgrims: draft.num_pilgrims,
                    nightsMakkah: draft.nights_makkah,
                    nightsMadinah: draft.nights_madinah,
                  })}{" "}
                  days
                </div>
              ) : null}
              {draft.subtotal > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Calculator className="size-4 text-primary" />
                  {formatMoney(draft.subtotal, draft.currency)} so far
                </div>
              ) : null}
            </dl>
            <Button
              render={<Link href={`/agent/book/umrah/private/${draft.id}?step=${draft.current_step}`} />}
              size="lg"
              className="mt-5 gap-2"
            >
              Resume <ArrowRight className="size-4" />
            </Button>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{draft.reference}</p>
          </>
        ) : (
          <>
            <Badge className="border-transparent bg-primary/10 text-primary">
              <UsersRound className="size-3.5" /> Custom build
            </Badge>
            <form action={startUmrahCustomRequest} className="mt-4">
              <input type="hidden" name="desk" value="1" />
              <SubmitButton size="lg" pendingText="Setting up…" className="gap-2">
                Start building <ArrowRight className="size-4" />
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
