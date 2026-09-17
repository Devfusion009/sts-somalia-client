import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getUmrahCustomRequest,
  getUmrahServices,
  getUmrahSharingPrices,
} from "@/modules/umrah/custom-queries";
import { isRoomSharing } from "@/modules/umrah/pricing";
import { discardUmrahCustomRequest } from "@/modules/umrah/custom-actions";
import type { PilgrimInput } from "@/modules/umrah/custom-actions";
import { BuilderStepper, PriceSummary } from "@/modules/umrah/components/builder-shared";
import { StepTrip } from "@/modules/umrah/components/step-trip";
import { StepServices } from "@/modules/umrah/components/step-services";
import { StepPilgrims } from "@/modules/umrah/components/step-pilgrims";
import { StepReview } from "@/modules/umrah/components/step-review";
import { AgencyBookingSlot } from "@/modules/agencies/components/agency-booking-slot";
import { SubmitButton } from "@/components/submit-button";
import { BackLink } from "@/components/back-link";

export const metadata: Metadata = { title: "Build a private Umrah" };

const BASE_PATH = "/agent/book/umrah/private";

export default async function AgentPrivateUmrahBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ requestId }, { step: stepParam }] = await Promise.all([params, searchParams]);
  const profile = await requireUser();

  const request = await getUmrahCustomRequest(requestId);
  // getUmrahCustomRequest is scoped by RLS to "the owner, its agency, or an
  // admin" — broader than what the agent desk needs. An agency teammate
  // opening a request another member is still building on isn't a security
  // hole (their RLS grant already allows read), but it would let them edit a
  // build mid-flow out from under whoever started it, so this narrows to the
  // one who actually owns the draft.
  if (!request || request.booked_by !== profile.id) notFound();
  if (request.status !== "draft") redirect("/agent/bookings");

  const maxStep = Math.min(Math.max(request.current_step, 1), 4);
  const requested = Number.parseInt(stepParam ?? "1", 10) || 1;
  const step = Math.min(Math.max(requested, 1), maxStep);

  const trip = {
    numPilgrims: request.num_pilgrims,
    nightsMakkah: request.nights_makkah,
    nightsMadinah: request.nights_madinah,
  };

  // Only the services step needs the whole catalog; the other three would be
  // paying for a query nothing renders.
  const [services, sharingPrices] =
    step === 2 ? await Promise.all([getUmrahServices(), getUmrahSharingPrices()]) : [[], {}];
  const roomSharing = isRoomSharing(request.room_sharing) ? request.room_sharing : 4;

  const savedLines = request.services.map((s) => ({
    id: s.id,
    category: s.category,
    name: s.name,
    quantity: s.quantity,
    unitPrice: s.unit_price,
    lineTotal: s.line_total,
  }));
  const pilgrims = Array.isArray(request.pilgrims) ? (request.pilgrims as PilgrimInput[]) : [];

  return (
    <div className="space-y-4">
      <BackLink href="/agent/book/umrah" label="Umrah" />

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BuilderStepper requestId={requestId} currentStep={step} maxStep={maxStep} basePath={BASE_PATH} />

          {/* Same reasoning as the marketing builder: steps 1 and 2 each own
              a form field this snapshot would otherwise contradict. */}
          {step === 3 || step === 4 ? (
            <PriceSummary
              lines={savedLines}
              total={request.subtotal}
              currency={request.currency}
              trip={trip}
              roomSharing={roomSharing}
              emptyText="No services chosen yet."
            />
          ) : null}

          <form action={discardUmrahCustomRequest}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="desk" value="1" />
            <SubmitButton
              variant="ghost"
              size="sm"
              pendingText="Discarding…"
              className="w-full gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Discard this trip
            </SubmitButton>
          </form>
        </aside>

        <div className="min-w-0">
          {step === 1 ? (
            <StepTrip
              requestId={requestId}
              desk
              initial={{
                tier: request.tier,
                numPilgrims: request.num_pilgrims,
                departureDate: request.departure_date,
                nightsMakkah: request.nights_makkah,
                nightsMadinah: request.nights_madinah,
                travellerNames: Array.from(
                  { length: request.num_pilgrims },
                  (_, i) => pilgrims[i]?.full_name ?? ""
                ),
              }}
            />
          ) : null}

          {step === 2 ? (
            <StepServices
              requestId={requestId}
              desk
              services={services}
              trip={trip}
              tier={request.tier}
              currency={request.currency}
              savedServiceIds={request.services
                .map((s) => s.service_id)
                .filter((id): id is string => id !== null)}
              initialRoomSharing={roomSharing}
              sharingPrices={sharingPrices}
            />
          ) : null}

          {step === 3 ? (
            <StepPilgrims
              requestId={requestId}
              desk
              numPilgrims={request.num_pilgrims}
              saved={pilgrims}
              notes={request.notes}
            />
          ) : null}

          {step === 4 ? (
            <StepReview
              requestId={requestId}
              desk
              reference={request.reference}
              tier={request.tier}
              trip={trip}
              roomSharing={roomSharing}
              departureDate={request.departure_date}
              lines={request.services}
              total={request.subtotal}
              currency={request.currency}
              pilgrims={pilgrims}
              notes={request.notes}
              bookedForSlot={<AgencyBookingSlot />}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
