import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Home, Trash2 } from "lucide-react";
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

export const metadata: Metadata = { title: "Build your private Umrah" };

export default async function PrivateUmrahBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ requestId }, { step: stepParam }] = await Promise.all([params, searchParams]);
  await requireUser();

  const request = await getUmrahCustomRequest(requestId);
  if (!request) notFound();
  // A submitted build is no longer editable (its RLS grant is gone, and the
  // priced lines are frozen), so send the customer to the tracker instead of
  // rendering a wizard whose every action would fail.
  if (request.status !== "draft") redirect("/account/bookings");

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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/umrah" className="hover:text-foreground">
          Umrah
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/umrah/private" className="hover:text-foreground">
          Private
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">Build</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BuilderStepper requestId={requestId} currentStep={step} maxStep={maxStep} />

          {/* Steps 1 and 2 both own a form field this summary would
              otherwise contradict: step 1 edits the exact traveller/night
              counts this card's header line states, and step 2 already
              renders its own live-updating summary next to the service
              picker. Showing this stale, last-SAVED snapshot alongside
              either would put two different numbers on the same screen —
              which is exactly the bug a customer flagged (the sidebar said
              "6 travellers" while the step 1 counter they'd just changed
              said "1"). Steps 3 and 4 don't edit those fields, so the
              snapshot and the visible form can never disagree there. */}
          {step === 3 || step === 4 ? (
            <PriceSummary
              lines={savedLines}
              total={request.subtotal}
              currency={request.currency}
              trip={trip}
              roomSharing={roomSharing}
              emptyText="You haven't chosen any services yet."
            />
          ) : null}

          <form action={discardUmrahCustomRequest}>
            <input type="hidden" name="requestId" value={requestId} />
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
              initial={{
                tier: request.tier,
                numPilgrims: request.num_pilgrims,
                departureDate: request.departure_date,
                nightsMakkah: request.nights_makkah,
                nightsMadinah: request.nights_madinah,
                // Padded/truncated to numPilgrims: `pilgrims` can be shorter
                // (nobody has reached step 3 yet) or, after someone reduces
                // the count, longer than it now needs to be.
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
              numPilgrims={request.num_pilgrims}
              saved={pilgrims}
              notes={request.notes}
            />
          ) : null}

          {step === 4 ? (
            <StepReview
              requestId={requestId}
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
