"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, ArrowLeft, Check, CloudUpload, FileCheck2, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/submit-button";
import { OptionPicker, RepeatableRows, BucketPicker } from "./field-helpers";
import { PhoneField } from "./phone-field";
import { AnalogTimeField } from "./analog-time-field";
import { RoomTypesField, type RoomTypeRow } from "./room-types-field";
import { RoleField } from "./role-field";
import { LocationField } from "@/components/location-field";
import {
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  uploadApplicationDocument,
  removeApplicationDocument,
  advanceToReview,
  submitApplication,
  type ActionState,
} from "../actions";
import {
  APP_CONFIG,
  BUSINESS_TYPES,
  VOLUME_RANGES,
  PRODUCTS,
  TRAFFIC_SOURCES,
  PROPERTY_TYPES,
  STAR_RATINGS,
  AMENITIES,
  CANCELLATION_POLICIES,
  PAYOUT_FREQUENCIES,
  docSlotsFor,
  stepLabel,
  type ApplicationKind,
  type DocSlot,
} from "../config";
import type { ApplicationRow, DocumentRef } from "../queries";

type AppRow = ApplicationRow;

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Debounced autosave: any change or click inside the form (typing, a native
 * select, or a click-based custom picker like BucketPicker/CountryCodeSelect
 * that don't fire native "change" events) schedules a save a moment later.
 *
 * Calls the useActionState dispatch DIRECTLY with a snapshotted FormData
 * rather than `form.requestSubmit()`. This is deliberate, not stylistic:
 * React 19 resets a <form>'s uncontrolled fields after an action bound via
 * its `action` prop finishes a real submit-event-driven submission — fine
 * for "Continue" (the page navigates away immediately after, so the reset
 * is invisible), but for autosave it was wiping out whatever the user had
 * just typed in an *earlier* field (e.g. business phone) the moment a
 * *later* field's autosave round-trip completed, since defaultValue-based
 * inputs snap back to their stale initial value on reset. Invoking the
 * dispatch as a plain function call bypasses the native submit-event path
 * entirely, so that auto-reset never triggers.
 */
function useAutosave(formRef: React.RefObject<HTMLFormElement | null>, formAction: (payload: FormData) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (formRef.current) formAction(new FormData(formRef.current));
    }, 900);
  }, [formRef, formAction]);
}

/**
 * A non-redirecting successful action result only ever comes from an
 * autosave submit — "Continue" always redirects on success instead — so
 * this is a plain derived value, no effect/state needed to track it.
 */
function isSaved(state: ActionState, pending: boolean): boolean {
  return !pending && state !== null && state.error === null;
}

function StepNav({
  backHref,
  nextLabel = "Continue",
  saving,
  saved,
}: {
  backHref?: string;
  nextLabel?: string;
  saving?: boolean;
  saved?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-3">
        {backHref ? (
          <Button type="button" variant="outline" className="gap-1.5" render={<Link href={backHref} />}>
            <ArrowLeft className="size-3.5" /> Back
          </Button>
        ) : (
          <span />
        )}
        {saving ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Saving…
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1 text-xs text-primary">
            <Check className="size-3" /> All changes saved
          </span>
        ) : null}
      </div>
      <SubmitButton name="intent" value="continue" className="gap-1.5" pendingText="Saving…">
        {nextLabel} <ArrowRight className="size-3.5" />
      </SubmitButton>
    </div>
  );
}

function ErrorAlert({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — business details                                                  */
/* -------------------------------------------------------------------------- */
export function StepBusiness({ kind, application, backHref }: { kind: ApplicationKind; application: AppRow; backHref: string }) {
  const [state, formAction, pending] = useActionState(saveStep1, null);
  const d = application.business_details;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={application.id} />
      <ErrorAlert state={state} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Legal business name *</Label>
          <Input name="legalBusinessName" defaultValue={s(d.legalBusinessName)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Trading name (if different)</Label>
          <Input name="tradingName" defaultValue={s(d.tradingName)} />
        </div>
        <div className="space-y-1.5">
          <Label>Business type *</Label>
          <OptionPicker
            name="businessType"
            defaultValue={s(d.businessType)}
            options={BUSINESS_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Year established</Label>
          <Input name="yearEstablished" type="number" min="1900" max="2026" defaultValue={s(d.yearEstablished)} />
        </div>
        <div className="space-y-1.5">
          <Label>Business registration number</Label>
          <Input name="registrationNumber" defaultValue={s(d.registrationNumber)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tax identification number</Label>
          <Input name="taxId" defaultValue={s(d.taxId)} />
        </div>
      </div>

      <Separator />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label>Office street address</Label>
          <Input name="officeStreet" defaultValue={s(d.officeStreet)} />
        </div>
        <div className="space-y-1.5">
          <Label>City *</Label>
          <LocationField name="officeCity" defaultValue={s(d.officeCity)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Region</Label>
          <Input name="officeRegion" defaultValue={s(d.officeRegion)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Branch offices (optional)</Label>
        <RepeatableRows
          hiddenFieldName="branchesJson"
          initialRows={Array.isArray(d.branches) ? (d.branches as { name: string; location: string }[]) : []}
          emptyRow={{ name: "", location: "" }}
          fields={[
            { key: "name", placeholder: "Branch name" },
            { key: "location", placeholder: "Location" },
          ]}
          addLabel="Add branch"
        />
      </div>

      <Separator />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Business phone *</Label>
          <PhoneField name="businessPhone" defaultValue={s(d.businessPhone)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Business email *</Label>
          <Input name="businessEmail" type="email" defaultValue={s(d.businessEmail)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Website (optional)</Label>
          <Input name="website" defaultValue={s(d.website)} placeholder="https://" />
        </div>
      </div>

      <StepNav backHref={backHref} saving={pending} saved={saved} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — authorized contact                                                */
/* -------------------------------------------------------------------------- */
export function StepContact({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction, pending] = useActionState(saveStep2, null);
  const d = application.business_details;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={application.id} />
      <ErrorAlert state={state} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Full name *</Label>
          <Input name="contactFullName" defaultValue={s(d.contactFullName)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Role / title *</Label>
          <RoleField name="contactRole" defaultValue={s(d.contactRole)} />
        </div>
        <div className="space-y-1.5">
          <Label>National ID or passport number *</Label>
          <Input name="contactIdNumber" defaultValue={s(d.contactIdNumber)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile number *</Label>
          <PhoneField name="contactMobile" defaultValue={s(d.contactMobile)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Email *</Label>
          <Input name="contactEmail" type="email" defaultValue={s(d.contactEmail)} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        You&apos;ll upload their ID/passport document in the Documents step.
      </p>

      <StepNav backHref={`/account/become/${kind}/${application.id}?step=1`} saving={pending} saved={saved} />
    </form>
  );
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel",
  aparthotel: "Aparthotel / Serviced apartments",
  guesthouse: "Guesthouse",
  resort: "Resort",
  hostel: "Hostel",
  villa: "Villa",
  boutique_bnb: "Boutique / B&B",
};

const STAR_RATING_LABELS: Record<string, string> = {
  unrated: "Not officially rated",
  "1": "1 star",
  "2": "2 stars",
  "3": "3 stars",
  "4": "4 stars",
  "5": "5 stars",
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "Free WiFi",
  parking: "Parking",
  pool: "Swimming pool",
  breakfast_included: "Breakfast included",
  airport_shuttle: "Airport shuttle",
  air_conditioning: "Air conditioning",
  restaurant: "On-site restaurant",
  gym: "Gym / fitness center",
  spa: "Spa",
  elevator: "Elevator",
  front_desk_24h: "24-hour front desk",
  non_smoking_rooms: "Non-smoking rooms available",
};

const CANCELLATION_POLICY_LABELS: Record<string, { label: string; hint: string }> = {
  flexible: { label: "Flexible", hint: "Free cancellation up to 24h before check-in" },
  moderate: { label: "Moderate", hint: "Free cancellation up to 5 days before check-in" },
  strict: { label: "Strict", hint: "Non-refundable" },
};

const PAYOUT_FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

function AmenitiesField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <div className="space-y-1.5">
      <Label>Amenities &amp; facilities</Label>
      <div className="flex flex-wrap gap-2">
        {AMENITIES.map((a) => (
          <label key={a} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={checked.includes(a)}
              onChange={(e) => setChecked((prev) => (e.target.checked ? [...prev, a] : prev.filter((v) => v !== a)))}
            />
            {AMENITY_LABELS[a]}
          </label>
        ))}
      </div>
      <input type="hidden" name="amenities" value={checked.join(",")} />
    </div>
  );
}

function ProductsField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <div className="space-y-1.5">
      <Label>Products you intend to book</Label>
      <div className="flex flex-wrap gap-3">
        {PRODUCTS.map((p) => (
          <label key={p} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={checked.includes(p)}
              onChange={(e) =>
                setChecked((prev) => (e.target.checked ? [...prev, p] : prev.filter((v) => v !== p)))
              }
            />
            {p[0].toUpperCase() + p.slice(1)}
          </label>
        ))}
      </div>
      {/* the server action reads "products" as one comma-joined string, not repeated form entries */}
      <input type="hidden" name="products" value={checked.join(",")} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — type-specific operations                                          */
/* -------------------------------------------------------------------------- */
export function StepOperations({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction, pending] = useActionState(saveStep3, null);
  const d = application.business_details;
  const backHref = `/account/become/${kind}/${application.id}?step=2`;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);

  if (kind === "hotel_partner") {
    const initialRoomTypes = Array.isArray(d.roomTypes) ? (d.roomTypes as RoomTypeRow[]) : [];
    const initialAmenities = Array.isArray(d.amenities) ? (d.amenities as string[]) : [];
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Property type *</Label>
            <OptionPicker
              name="propertyType"
              defaultValue={s(d.propertyType)}
              options={PROPERTY_TYPES.map((t) => ({ value: t, label: PROPERTY_TYPE_LABELS[t] }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Star rating *</Label>
            <OptionPicker
              name="starRating"
              defaultValue={s(d.starRating)}
              options={STAR_RATINGS.map((r) => ({ value: r, label: STAR_RATING_LABELS[r] }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Property name *</Label>
            <Input name="propertyName" defaultValue={s(d.propertyName)} required />
          </div>
        </div>

        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Property street address</Label>
            <Input name="propertyStreet" defaultValue={s(d.propertyStreet)} placeholder="Distinct from your office address, if different" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>City *</Label>
            <LocationField name="location" defaultValue={s(d.location)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Total rooms / units *</Label>
            <Input name="totalRooms" type="number" min="1" defaultValue={s(d.totalRooms)} required />
          </div>
        </div>

        <Separator />
        <RoomTypesField initial={initialRoomTypes} />

        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Check-in time *</Label>
            <AnalogTimeField name="checkInTime" defaultValue={s(d.checkInTime) || "14:00"} required />
          </div>
          <div className="space-y-1.5">
            <Label>Check-out time *</Label>
            <AnalogTimeField name="checkOutTime" defaultValue={s(d.checkOutTime) || "12:00"} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Cancellation policy *</Label>
            <OptionPicker
              name="cancellationPolicy"
              defaultValue={s(d.cancellationPolicy)}
              layout="stack"
              options={CANCELLATION_POLICIES.map((c) => ({ value: c, ...CANCELLATION_POLICY_LABELS[c] }))}
            />
          </div>
        </div>

        <Separator />
        <AmenitiesField initial={initialAmenities} />

        <p className="text-xs text-muted-foreground">
          Photos and live rates/availability are set up in the partner portal once you&apos;re approved.
        </p>

        <StepNav backHref={backHref} saving={pending} saved={saved} />
      </form>
    );
  }

  if (kind === "affiliate") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <div className="space-y-1.5">
          <Label>Website / social handles</Label>
          <RepeatableRows
            hiddenFieldName="handlesJson"
            initialRows={Array.isArray(d.handles) ? (d.handles as { platform: string; handle: string }[]) : []}
            emptyRow={{ platform: "", handle: "" }}
            fields={[
              { key: "platform", placeholder: "Platform (e.g. Instagram)" },
              { key: "handle", placeholder: "Handle or URL" },
            ]}
            addLabel="Add handle"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Audience size</Label>
            <Input name="audienceSize" type="number" min="0" defaultValue={s(d.audienceSize)} placeholder="e.g. 15000" />
          </div>
          <div className="space-y-1.5">
            <Label>Primary traffic source *</Label>
            <OptionPicker
              name="trafficSource"
              defaultValue={s(d.trafficSource)}
              options={TRAFFIC_SOURCES.map((t) => ({ value: t, label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
            />
          </div>
        </div>
        <StepNav backHref={backHref} saving={pending} saved={saved} />
      </form>
    );
  }

  // agency
  const initialProducts = Array.isArray(d.products) ? (d.products as string[]) : [];
  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={application.id} />
      <ErrorAlert state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Years of experience in travel</Label>
          <BucketPicker
            name="yearsExperience"
            defaultValue={s(d.yearsExperience)}
            options={["<1", "1-2", "3-5", "5-10", "10+"]}
            customPlaceholder="Exact years"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Number of staff using the platform</Label>
          <BucketPicker
            name="staffCount"
            defaultValue={s(d.staffCount)}
            options={["1", "2-5", "5-10", "10+"]}
            customPlaceholder="Exact headcount"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Estimated monthly booking volume *</Label>
          <OptionPicker
            name="monthlyVolume"
            defaultValue={s(d.monthlyVolume)}
            options={VOLUME_RANGES.map((r) => ({ value: r, label: r }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>IATA number or local travel association license (optional)</Label>
          <Input name="iataNumber" defaultValue={s(d.iataNumber)} />
        </div>
      </div>
      <ProductsField initial={initialProducts} />
      <StepNav backHref={backHref} saving={pending} saved={saved} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 4 — settlement                                                        */
/* -------------------------------------------------------------------------- */
export function StepSettlement({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction, pending] = useActionState(saveStep4, null);
  const d = application.business_details;
  const [paymentModel, setPaymentModel] = useState(s(d.paymentModel) || "prepaid_wallet");
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);
  const backHref = `/account/become/${kind}/${application.id}?step=3`;

  // A hotel is a supplier: it's paid out for completed stays, not billed —
  // so instead of the agency's "how you'll pay us" wallet/credit-line
  // choice, it only picks a payout cadence, and bank details are mandatory
  // (they're the whole point of this step for a hotel).
  if (kind === "hotel_partner") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />

        <div className="space-y-1.5">
          <Label>Payout frequency *</Label>
          <OptionPicker
            name="payoutFrequency"
            defaultValue={s(d.payoutFrequency)}
            options={PAYOUT_FREQUENCIES.map((f) => ({ value: f, label: PAYOUT_FREQUENCY_LABELS[f] }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Guests pay STS Somalia at booking. Your share for completed stays is paid out to the account below on this
          schedule, less the platform commission.
        </p>

        <Separator />
        <p className="text-sm font-medium">Bank account details (for payouts) *</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Bank name *</Label>
            <Input name="bankName" defaultValue={s(d.bankName)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Account name *</Label>
            <Input name="bankAccountName" defaultValue={s(d.bankAccountName)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Account number *</Label>
            <Input name="bankAccountNumber" defaultValue={s(d.bankAccountNumber)} required />
          </div>
        </div>

        <StepNav backHref={backHref} saving={pending} saved={saved} />
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={application.id} />
      <ErrorAlert state={state} />

      <div className="space-y-1.5">
        <Label>Preferred payment model *</Label>
        <OptionPicker
          name="paymentModel"
          defaultValue={paymentModel}
          onChange={setPaymentModel}
          layout="stack"
          options={[
            { value: "prepaid_wallet", label: "Prepaid wallet top-up" },
            { value: "credit_line", label: "Request a credit line" },
          ]}
        />
      </div>

      {paymentModel === "credit_line" ? (
        <div className="space-y-1.5">
          <Label>Estimated monthly volume (to help size your limit)</Label>
          <Input name="estimatedMonthlyVolume" defaultValue={s(d.estimatedMonthlyVolume)} placeholder="e.g. USD 5,000" />
        </div>
      ) : null}

      <Separator />
      <p className="text-sm font-medium">Bank account details (for refunds / payouts)</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Bank name</Label>
          <Input name="bankName" defaultValue={s(d.bankName)} />
        </div>
        <div className="space-y-1.5">
          <Label>Account name</Label>
          <Input name="bankAccountName" defaultValue={s(d.bankAccountName)} />
        </div>
        <div className="space-y-1.5">
          <Label>Account number</Label>
          <Input name="bankAccountNumber" defaultValue={s(d.bankAccountNumber)} />
        </div>
      </div>

      <StepNav backHref={backHref} saving={pending} saved={saved} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 5 — documents                                                         */
/* -------------------------------------------------------------------------- */
/**
 * Uploads the instant a file is chosen — no separate "Upload" click. The
 * previous two-step pattern (choose file, then click a distinct Upload
 * button per row) is exactly how an applicant could select every document
 * and still submit with document_refs empty: selecting a file alone never
 * persisted anything. Auto-submitting on change removes that failure mode
 * entirely, and the pending/error state is impossible to miss since it
 * replaces the dropzone itself rather than sitting in small text below it.
 */
function DocUploadRow({
  kind,
  applicationId,
  slot,
  existing,
}: {
  kind: ApplicationKind;
  applicationId: string;
  slot: DocSlot;
  existing?: DocumentRef;
}) {
  const [state, formAction, pending] = useActionState(uploadApplicationDocument, null);
  const [expiry, setExpiry] = useState("");
  const isExpired = slot.expiryField && expiry && new Date(expiry) < new Date(new Date().toDateString());

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {slot.label} {slot.optional ? <span className="text-xs text-muted-foreground">(optional)</span> : <span className="text-destructive">*</span>}
        </p>
        {existing ? (
          <form action={removeApplicationDocument}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="docKey" value={slot.key} />
            <Button type="submit" variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" /> Remove
            </Button>
          </form>
        ) : null}
      </div>

      {slot.expiryField ? (
        <div className="mt-2 max-w-xs space-y-1">
          <Label className="text-xs">Expiry date</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          {isExpired ? (
            <p className="text-xs text-destructive">This license has expired — you&apos;ll need a current one to submit.</p>
          ) : null}
        </div>
      ) : null}

      {existing ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
          <FileCheck2 className="size-4" /> {existing.file_name} uploaded
        </p>
      ) : (
        <form action={formAction} className="mt-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="docKey" value={slot.key} />
          <input type="hidden" name="docLabel" value={slot.label} />
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition-colors ${
              pending ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent"
            }`}
          >
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
              }}
            />
            <CloudUpload className="size-4 shrink-0" />
            {pending ? "Uploading…" : "Click to choose a file — uploads automatically"}
          </label>
        </form>
      )}
      {state?.error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function StepDocuments({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const slots = docSlotsFor(kind);
  const backStep = kind === "affiliate" ? 3 : 4;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Upload the documents below. JPG, PNG, or PDF, up to 5MB each.</p>
      {slots.map((slot) => (
        <DocUploadRow key={slot.key} kind={kind} applicationId={application.id} slot={slot} existing={refs.find((r) => r.key === slot.key)} />
      ))}
      <form action={advanceToReview}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <StepNav backHref={`/account/become/${kind}/${application.id}?step=${backStep}`} nextLabel="Continue to Review" />
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 6 — review & submit                                                   */
/* -------------------------------------------------------------------------- */
function SummaryRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? (value as unknown[]).map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ") : String(value);
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{display}</span>
    </div>
  );
}

export function StepReview({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction] = useActionState(submitApplication, null);
  const d = application.business_details;
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const uploadedKeys = new Set(refs.map((r) => r.key));
  const missingRequiredDocs = docSlotsFor(kind).filter((slot) => !slot.optional && !uploadedKeys.has(slot.key));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Business details</p>
          <Link href={`/account/become/${kind}/${application.id}?step=1`} className="text-xs text-primary hover:underline">
            Edit
          </Link>
        </div>
        <SummaryRow label="Legal business name" value={d.legalBusinessName} />
        <SummaryRow label="Trading name" value={d.tradingName} />
        <SummaryRow label="Business type" value={d.businessType} />
        <SummaryRow label="City" value={d.officeCity} />
        <SummaryRow label="Business phone" value={d.businessPhone} />
        <SummaryRow label="Business email" value={d.businessEmail} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Authorized contact</p>
          <Link href={`/account/become/${kind}/${application.id}?step=2`} className="text-xs text-primary hover:underline">
            Edit
          </Link>
        </div>
        <SummaryRow label="Name" value={d.contactFullName} />
        <SummaryRow label="Role" value={d.contactRole} />
        <SummaryRow label="Mobile" value={d.contactMobile} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{stepLabel(kind, 3)}</p>
          <Link href={`/account/become/${kind}/${application.id}?step=3`} className="text-xs text-primary hover:underline">
            Edit
          </Link>
        </div>
        {kind === "agency" ? (
          <>
            <SummaryRow label="Monthly volume" value={d.monthlyVolume} />
            <SummaryRow label="Products" value={d.products} />
          </>
        ) : kind === "hotel_partner" ? (
          <>
            <SummaryRow label="Property type" value={d.propertyType ? PROPERTY_TYPE_LABELS[String(d.propertyType)] : null} />
            <SummaryRow label="Property" value={d.propertyName} />
            <SummaryRow label="Star rating" value={d.starRating ? STAR_RATING_LABELS[String(d.starRating)] : null} />
            <SummaryRow label="City" value={d.location} />
            <SummaryRow label="Total rooms" value={d.totalRooms} />
            <SummaryRow
              label="Room types"
              value={Array.isArray(d.roomTypes) ? (d.roomTypes as RoomTypeRow[]).map((r) => r.typeName).join(", ") : null}
            />
            <SummaryRow label="Check-in / check-out" value={d.checkInTime && d.checkOutTime ? `${d.checkInTime} / ${d.checkOutTime}` : null} />
            <SummaryRow
              label="Amenities"
              value={
                Array.isArray(d.amenities) && d.amenities.length > 0
                  ? (d.amenities as string[]).map((a) => AMENITY_LABELS[a] ?? a).join(", ")
                  : null
              }
            />
          </>
        ) : (
          <SummaryRow label="Traffic source" value={d.trafficSource} />
        )}
      </div>

      {APP_CONFIG[kind].hasSettlementStep ? (
        <div className="rounded-xl border border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Settlement</p>
            <Link href={`/account/become/${kind}/${application.id}?step=4`} className="text-xs text-primary hover:underline">
              Edit
            </Link>
          </div>
          {kind === "hotel_partner" ? (
            <SummaryRow label="Payout frequency" value={d.payoutFrequency ? PAYOUT_FREQUENCY_LABELS[String(d.payoutFrequency)] : null} />
          ) : (
            <SummaryRow label="Payment model" value={d.paymentModel === "credit_line" ? "Credit line" : "Prepaid wallet"} />
          )}
          <SummaryRow label="Bank" value={d.bankName} />
          <SummaryRow label="Account name" value={d.bankAccountName} />
        </div>
      ) : null}

      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Documents ({refs.length})</p>
          <Link href={`/account/become/${kind}/${application.id}?step=5`} className="text-xs text-primary hover:underline">
            Edit
          </Link>
        </div>
        {refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {refs.map((r) => (
              <li key={r.key} className="flex items-center gap-1.5 text-muted-foreground">
                <FileCheck2 className="size-3.5 text-primary" /> {r.label}
              </li>
            ))}
          </ul>
        )}
        {missingRequiredDocs.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle />
            <AlertDescription>
              Still needed before you can submit: {missingRequiredDocs.map((s) => s.label).join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeTerms" required className="mt-0.5" />
          <span>
            I agree to the STS Somalia{" "}
            <Link href="/partner-terms" className="text-primary hover:underline" target="_blank">
              Partner Terms &amp; Conditions
            </Link>
            .
          </span>
        </label>
        <StepNav backHref={`/account/become/${kind}/${application.id}?step=5`} nextLabel="Submit Application" />
      </form>
    </div>
  );
}
