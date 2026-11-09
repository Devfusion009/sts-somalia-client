import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, Settings2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
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
      <div className="space-y-4">
        <BackLink href="/agent/book/umrah" label="Umrah" />
        <PageHeader title="Private Umrah" />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Could not start the trip. Try again.</AlertDescription>
        </Alert>
      ) : null}

      {draft ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-base font-semibold">Draft in progress</h2>
                  <Badge variant="neutral" className="font-mono">
                    {draft.reference}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {UMRAH_TIER_LABELS[draft.tier]} · Step {draft.current_step} of 4
                </p>
              </div>
              <Button
                size="lg"
                className="max-sm:w-full"
                render={<Link href={`/agent/book/umrah/private/${draft.id}?step=${draft.current_step}`} />}
              >
                Resume <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </div>

            <StatRail className="sm:grid-cols-3">
              <StatRailItem
                label="Travellers"
                value={draft.num_pilgrims}
              />
              <StatRailItem
                label="Days"
                value={
                  draft.nights_makkah + draft.nights_madinah > 0
                    ? tripDurationDays({
                        numPilgrims: draft.num_pilgrims,
                        nightsMakkah: draft.nights_makkah,
                        nightsMadinah: draft.nights_madinah,
                      })
                    : "—"
                }
              />
              <StatRailItem
                label="Subtotal"
                value={draft.subtotal > 0 ? <AgentMoney value={formatMoney(draft.subtotal, draft.currency)} /> : "—"}
              />
            </StatRail>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <Settings2 />
            </EmptyMedia>
            <EmptyTitle>Build a trip from scratch</EmptyTitle>
            <EmptyContent>
              <form action={startUmrahCustomRequest}>
                <input type="hidden" name="desk" value="1" />
                <SubmitButton size="lg" pendingText="Setting up…">
                  Start building <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </SubmitButton>
              </form>
            </EmptyContent>
          </Empty>
        </Card>
      )}
    </div>
  );
}
