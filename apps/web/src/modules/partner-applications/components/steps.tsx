"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Check,
  FileBadge2,
  FileCheck2,
  FileText,
  Globe,
  Handshake,
  Hash,
  IdCard,
  Landmark,
  Loader2,
  Mail,
  MapPinned,
  MoreVertical,
  Paperclip,
  Receipt,
  Shield,
  ShieldCheck,
  Tag,
  User,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { OptionPicker, RepeatableRows, BucketPicker } from "./field-helpers";
import { PhoneField } from "./phone-field";
import { AnalogTimeField } from "./analog-time-field";
import { RoomTypesField, type RoomTypeRow } from "./room-types-field";
import { RoleField } from "./role-field";
import { CountryField } from "./country-field";
import { YearField } from "./year-field";
import { LocationField } from "@/components/location-field";
import {
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  uploadApplicationDocument,
  removeApplicationDocument,
  updateDocumentExpiry,
  getDocumentViewUrl,
  advanceToReview,
  submitApplication,
  type ActionState,
} from "../actions";
import { checkUploadFile } from "../schemas";
import {
  APP_CONFIG,
  BUSINESS_TYPES,
  EARLIEST_BUSINESS_YEAR,
  CURRENT_YEAR,
  VOLUME_RANGES,
  PRODUCTS,
  ORG_MEMBER_TYPES,
  ORG_MEMBER_TYPE_LABELS,
  TRAFFIC_SOURCES,
  AUDIENCE_LOCATIONS,
  AUDIENCE_LOCATION_LABELS,
  VENUE_EVENT_TYPES,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  STAR_RATINGS,
  STAR_RATING_LABELS,
  AMENITIES,
  AMENITY_LABELS,
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_LABELS,
  PAYOUT_FREQUENCIES,
  PAYOUT_FREQUENCY_LABELS,
  MARKUP_PRESETS,
  docSlotsFor,
  missingRequiredDocSlots,
  stepLabel,
  type ApplicationKind,
  type DocSlot,
} from "../config";
import type { ApplicationRow, DocumentRef, DocumentReview } from "../queries";
import { partnerLogoUrl } from "../logo-url";
import { FileField } from "@/components/ui/upload";

type AppRow = ApplicationRow;

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const BUSINESS_TYPE_ICONS: Record<(typeof BUSINESS_TYPES)[number], LucideIcon> = {
  sole_proprietorship: User,
  partnership: Handshake,
  llc: Shield,
  corporation: Landmark,
};


/** A plain `<Input>` with a leading icon — the small visual lift image-based reference forms use on every field, applied to this wizard's identity/document-number inputs. */
function IconInput({ icon: Icon, className, ...props }: { icon: LucideIcon } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
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
      if (!formRef.current) return;
      const payload = new FormData(formRef.current);
      startTransition(() => formAction(payload));
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

/**
 * Restores plain <Input>/<Textarea> fields after a "Continue" click that
 * comes back with a validation error (e.g. a required OptionPicker field
 * left unset while everything else was filled in).
 *
 * "Continue" is deliberately still a real submit — that's what lets
 * redirect() on success turn into an actual page navigation; routing it
 * through the same non-native dispatch bypass useAutosave uses (tried
 * first) silently breaks that: the action ran and persisted correctly, but
 * the browser never left the page, since Next.js's redirect-to-navigation
 * handling is wired to the form's real submit event, not to calling the
 * useActionState dispatcher directly.
 *
 * So the real submit stays, and with it React 19's post-settle reset of
 * uncontrolled fields to their defaultValue — invisible on success (the
 * page navigates away before it'd be seen) but not on a validation error,
 * where the same form instance stays mounted and defaultValue is still
 * whatever the page's ORIGINAL server data was. For a field never
 * autosaved yet (this step's whole schema validates as one unit, so
 * autosave fails right alongside "Continue" until every required field is
 * set), that default is empty — so the reset wipes it to blank, not back
 * to what was typed. OptionPicker/BucketPicker/etc. are unaffected: their
 * hidden inputs are React-controlled (value={state}), which this reset
 * mechanism never touches.
 *
 * Snapshots the form on every real submit, then replays that snapshot onto
 * the DOM the moment an error comes back — after React's own reset has
 * already run, so this always gets the last word.
 */
function useRestoreOnError(formRef: React.RefObject<HTMLFormElement | null>, state: ActionState) {
  const snapshotRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const capture = () => {
      snapshotRef.current = Object.fromEntries(
        Array.from(new FormData(form).entries(), ([k, v]) => [k, String(v)])
      );
    };
    form.addEventListener("submit", capture);
    return () => form.removeEventListener("submit", capture);
  }, [formRef]);

  useEffect(() => {
    const snapshot = snapshotRef.current;
    const form = formRef.current;
    if (!state?.error || !snapshot || !form) return;
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) continue;
      if (el.type === "checkbox" || el.type === "radio" || el.type === "file") continue;
      if (!el.name || !(el.name in snapshot)) continue;
      el.value = snapshot[el.name];
    }
  }, [state, formRef]);
}

function StepNav({
  backHref,
  nextLabel = "Continue",
  saving,
  saved,
  note,
}: {
  backHref?: string;
  nextLabel?: string;
  saving?: boolean;
  saved?: boolean;
  note?: string;
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
        ) : note ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" /> {note}
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
/* Step 1 — business details (agency / hotel_partner) or "about you" (affiliate) */
/* -------------------------------------------------------------------------- */
export function StepBusiness({ kind, application, backHref }: { kind: ApplicationKind; application: AppRow; backHref: string }) {
  const [state, formAction, pending] = useActionState(saveStep1, null);
  const d = application.business_details;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);
  useRestoreOnError(formRef, state);

  if (kind === "affiliate") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input name="fullName" defaultValue={s(d.fullName)} required />
          </div>
          <div className="space-y-1.5">
            <Label>City *</Label>
            <LocationField name="city" defaultValue={s(d.city)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile number *</Label>
            <PhoneField name="mobile" defaultValue={s(d.mobile)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input name="email" type="email" defaultValue={s(d.email)} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Where is your audience mainly based? *</Label>
            <OptionPicker
              name="audienceLocation"
              defaultValue={s(d.audienceLocation)}
              options={AUDIENCE_LOCATIONS.map((v) => ({ value: v, label: AUDIENCE_LOCATION_LABELS[v] }))}
            />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Legal business name *</Label>
          <IconInput icon={Building2} name="legalBusinessName" defaultValue={s(d.legalBusinessName)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Trading name (if different)</Label>
          <IconInput icon={Tag} name="tradingName" defaultValue={s(d.tradingName)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Business type *</Label>
          <OptionPicker
            name="businessType"
            defaultValue={s(d.businessType)}
            layout="cards"
            options={BUSINESS_TYPES.map((t) => ({
              value: t,
              label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              icon: BUSINESS_TYPE_ICONS[t],
            }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Year established *</Label>
          <YearField name="yearEstablished" defaultValue={s(d.yearEstablished)} min={EARLIEST_BUSINESS_YEAR} max={CURRENT_YEAR} required />
        </div>
        <div className="space-y-1.5">
          <Label>Business registration number</Label>
          <IconInput icon={FileBadge2} name="registrationNumber" defaultValue={s(d.registrationNumber)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tax identification number</Label>
          <IconInput icon={Receipt} name="taxId" defaultValue={s(d.taxId)} />
        </div>
      </div>

      <Separator />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label>Office street address</Label>
          <IconInput icon={MapPinned} name="officeStreet" defaultValue={s(d.officeStreet)} />
        </div>
        <div className="space-y-1.5">
          <Label>City *</Label>
          <LocationField name="officeCity" defaultValue={s(d.officeCity)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Region</Label>
          <Input name="officeRegion" defaultValue={s(d.officeRegion)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <CountryField name="officeCountry" defaultValue={s(d.officeCountry) || "Somalia"} />
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
          <IconInput icon={Mail} name="businessEmail" type="email" defaultValue={s(d.businessEmail)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Website (optional)</Label>
          <IconInput icon={Globe} name="website" defaultValue={s(d.website)} placeholder="https://" />
        </div>
      </div>

      <StepNav backHref={backHref} saving={pending} saved={saved} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — authorized contact (agency / hotel_partner) or identity verification (affiliate) */
/* -------------------------------------------------------------------------- */
export function StepContact({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction, pending] = useActionState(saveStep2, null);
  const d = application.business_details;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);
  useRestoreOnError(formRef, state);

  if (kind === "affiliate") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <div className="space-y-1.5">
          <Label>National ID or passport number *</Label>
          <Input name="idNumber" defaultValue={s(d.idNumber)} required />
        </div>
        <StepNav backHref={`/account/become/${kind}/${application.id}?step=1`} saving={pending} saved={saved} />
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={application.id} />
      <ErrorAlert state={state} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Full name *</Label>
          <IconInput icon={User} name="contactFullName" defaultValue={s(d.contactFullName)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Role / title *</Label>
          <RoleField name="contactRole" defaultValue={s(d.contactRole)} />
        </div>
        <div className="space-y-1.5">
          <Label>National ID or passport number *</Label>
          <IconInput icon={IdCard} name="contactIdNumber" defaultValue={s(d.contactIdNumber)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile number *</Label>
          <PhoneField name="contactMobile" defaultValue={s(d.contactMobile)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Email *</Label>
          <IconInput icon={Mail} name="contactEmail" type="email" defaultValue={s(d.contactEmail)} required />
        </div>
      </div>

      <StepNav backHref={`/account/become/${kind}/${application.id}?step=1`} saving={pending} saved={saved} />
    </form>
  );
}

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

/** Yes/No gate over a trade-association type picker — the picker (and the membership certificate upload elsewhere on the page) only makes sense once "Yes" is chosen. */
function OrgMemberField({
  initialIsMember,
  initialType,
  initialNumber,
}: {
  initialIsMember: string;
  initialType: string;
  initialNumber: string;
}) {
  const [isMember, setIsMember] = useState(initialIsMember || "no");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Member of a travel trade association?</Label>
        <OptionPicker
          name="isOrgMember"
          defaultValue={isMember}
          onChange={setIsMember}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
      </div>
      {isMember === "yes" ? (
        <>
          <div className="space-y-1.5">
            <Label>Association</Label>
            <OptionPicker
              name="orgMemberType"
              defaultValue={initialType}
              options={ORG_MEMBER_TYPES.map((t) => ({ value: t, label: ORG_MEMBER_TYPE_LABELS[t] }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Membership number</Label>
            <Input name="iataNumber" defaultValue={initialNumber} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function VenueEventTypesField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <div className="space-y-1.5">
      <Label>Events your venue hosts</Label>
      <div className="flex flex-wrap gap-2">
        {VENUE_EVENT_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={checked.includes(t)}
              onChange={(e) => setChecked((prev) => (e.target.checked ? [...prev, t] : prev.filter((v) => v !== t)))}
            />
            {t[0].toUpperCase() + t.slice(1)}
          </label>
        ))}
      </div>
      <input type="hidden" name="eventTypes" value={checked.join(",")} />
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
  useRestoreOnError(formRef, state);

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

        <StepNav backHref={backHref} saving={pending} saved={saved} />
      </form>
    );
  }

  if (kind === "venue_partner") {
    const initialEventTypes = Array.isArray(d.eventTypes) ? (d.eventTypes as string[]) : [];
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Venue name *</Label>
            <Input name="venueName" defaultValue={s(d.venueName)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Location / city *</Label>
            <LocationField name="location" defaultValue={s(d.location)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Seated capacity</Label>
            <Input name="seatedCapacity" type="number" min="1" defaultValue={s(d.seatedCapacity)} placeholder="e.g. 300" />
          </div>
          <div className="space-y-1.5">
            <Label>Standing capacity *</Label>
            <Input name="standingCapacity" type="number" min="1" defaultValue={s(d.standingCapacity)} placeholder="e.g. 500" required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Indicative price (USD, optional)</Label>
            <Input name="indicativePrice" type="number" min="0" defaultValue={s(d.indicativePrice)} placeholder="e.g. 1500 per event" />
          </div>
        </div>
        <VenueEventTypesField initial={initialEventTypes} />
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
        <div className="space-y-1.5">
          <Label>How do you plan to promote STS Somalia? *</Label>
          <Textarea
            name="promotionPlan"
            rows={3}
            defaultValue={s(d.promotionPlan)}
            placeholder="e.g. I post Umrah travel tips to my Instagram followers and share deals in a Somali diaspora WhatsApp group."
            required
          />
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
      </div>
      <Separator />
      <OrgMemberField initialIsMember={s(d.isOrgMember)} initialType={s(d.orgMemberType)} initialNumber={s(d.iataNumber)} />
      <Separator />
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
  const savedMarkup = d.requestedMarkupPercent == null || d.requestedMarkupPercent === "" ? null : Number(d.requestedMarkupPercent);
  const savedMarkupIsPreset = savedMarkup !== null && MARKUP_PRESETS.includes(savedMarkup);
  const [markupPreset, setMarkupPreset] = useState(savedMarkup === null ? "" : savedMarkupIsPreset ? String(savedMarkup) : "custom");
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave(formRef, formAction);
  const saved = isSaved(state, pending);
  useRestoreOnError(formRef, state);
  const backHref = `/account/become/${kind}/${application.id}?step=3`;

  // A hotel or venue is a supplier: it's paid out for completed stays/events,
  // not billed — so instead of the agency's "how you'll pay us" wallet/
  // credit-line choice, it only picks a payout cadence, and bank details are
  // mandatory (they're the whole point of this step for a supplier).
  if (kind === "hotel_partner" || kind === "venue_partner") {
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
          {kind === "hotel_partner" ? "Guests" : "Customers"} pay STS Somalia at booking. Your share for completed{" "}
          {kind === "hotel_partner" ? "stays" : "events"} is paid out to the account below on this schedule, less the
          platform commission.
        </p>

        <Separator />
        <p className="text-sm font-medium">Bank account details (for payouts) *</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Bank name *</Label>
            <IconInput icon={Landmark} name="bankName" defaultValue={s(d.bankName)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Account name *</Label>
            <IconInput icon={User} name="bankAccountName" defaultValue={s(d.bankAccountName)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Account number *</Label>
            <IconInput icon={Hash} name="bankAccountNumber" defaultValue={s(d.bankAccountNumber)} required />
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
          layout="cards"
          options={[
            { value: "prepaid_wallet", label: "Prepaid wallet top-up", icon: Wallet },
            { value: "credit_line", label: "Request a credit line", icon: Landmark },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="requestedMarkupPreset">Your markup on STS net prices *</Label>
          <select
            id="requestedMarkupPreset"
            name="requestedMarkupPreset"
            value={markupPreset}
            onChange={(e) => setMarkupPreset(e.target.value)}
            required
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              Select
            </option>
            {MARKUP_PRESETS.map((p) => (
              <option key={p} value={String(p)}>
                {p}%
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>
        {markupPreset === "custom" ? (
          <div className="space-y-1.5">
            <Label htmlFor="requestedMarkupCustom">Custom markup (%) *</Label>
            <Input
              id="requestedMarkupCustom"
              name="requestedMarkupCustom"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={savedMarkup !== null && !savedMarkupIsPreset ? String(savedMarkup) : ""}
              required
            />
          </div>
        ) : null}
      </div>

      <Separator />
      <p className="text-sm font-medium">Bank account details (for refunds / payouts)</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Bank name</Label>
          <IconInput icon={Landmark} name="bankName" defaultValue={s(d.bankName)} />
        </div>
        <div className="space-y-1.5">
          <Label>Account name</Label>
          <IconInput icon={User} name="bankAccountName" defaultValue={s(d.bankAccountName)} />
        </div>
        <div className="space-y-1.5">
          <Label>Account number</Label>
          <IconInput icon={Hash} name="bankAccountNumber" defaultValue={s(d.bankAccountNumber)} />
        </div>
      </div>

      <Separator />
      <div className="space-y-1.5">
        <Label>Remarks</Label>
        <Textarea name="remarks" rows={3} defaultValue={s(d.remarks)} />
      </div>

      <StepNav backHref={backHref} saving={pending} saved={saved} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 5 — documents                                                         */
/* -------------------------------------------------------------------------- */
/** Cycled by slot position purely for visual variety — not tied to file type. */
const DOC_ICON_STYLES = [
  "bg-emerald-100 text-emerald-600",
  "bg-blue-100 text-blue-600",
  "bg-amber-100 text-amber-600",
  "bg-violet-100 text-violet-600",
  "bg-rose-100 text-rose-600",
];

function formatFileSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

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
  review,
  iconIndex,
}: {
  kind: ApplicationKind;
  applicationId: string;
  slot: DocSlot;
  existing?: DocumentRef;
  review?: DocumentReview;
  iconIndex: number;
}) {
  const [state, formAction] = useActionState(uploadApplicationDocument, null);
  const [expiryState, expiryAction, expiryPending] = useActionState(updateDocumentExpiry, null);
  const [expiry, setExpiry] = useState(existing?.expiry ?? "");
  const removeFormRef = useRef<HTMLFormElement>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const isExpired = slot.expiryField && expiry && new Date(expiry) < new Date(new Date().toDateString());
  const isRejected = review?.status === "rejected";
  const isVerified = review?.status === "verified";

  async function handleView() {
    setViewLoading(true);
    const result = await getDocumentViewUrl(kind, applicationId, slot.key);
    setViewLoading(false);
    if ("url" in result) window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cn("rounded-xl border p-4", isRejected ? "border-destructive/50 bg-destructive/5" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", DOC_ICON_STYLES[iconIndex % DOC_ICON_STYLES.length])}>
            <FileText className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {slot.label} {slot.optional ? <span className="text-xs text-muted-foreground">(optional)</span> : <span className="text-destructive">*</span>}
            </p>
            {existing ? (
              <>
                <button
                  type="button"
                  onClick={handleView}
                  disabled={viewLoading}
                  className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-60"
                >
                  <Paperclip className="size-3.5" /> {existing.file_name}
                </button>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Uploaded on {formatUploadDate(existing.uploaded_at)}
                  {formatFileSize(existing.file_size) ? ` • ${formatFileSize(existing.file_size)}` : ""}
                </p>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isRejected ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <XCircle className="size-3" /> Rejected
            </span>
          ) : isVerified ? (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="size-3" /> Verified
            </span>
          ) : existing ? (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Check className="size-3" /> Uploaded
            </span>
          ) : null}
          {existing ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" className="size-8" />}>
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<button type="button" className="w-full" onClick={handleView} />}>View document</DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  render={<button type="button" className="w-full" onClick={() => removeFormRef.current?.requestSubmit()} />}
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {isRejected && review?.note ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {review.note}
        </p>
      ) : null}

      <form ref={removeFormRef} action={removeApplicationDocument} className="hidden">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="docKey" value={slot.key} />
      </form>

      {slot.expiryField ? (
        <form action={expiryAction} className="mt-3 max-w-xs space-y-1">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="docKey" value={slot.key} />
          <Label className="text-xs">
            Expiry date {slot.optional ? null : <span className="text-destructive">*</span>}
          </Label>
          <Input
            type="date"
            name="expiry"
            min="1900-01-01"
            max="2100-12-31"
            value={expiry}
            disabled={!existing}
            onChange={(e) => {
              setExpiry(e.target.value);
              if (existing) e.currentTarget.form?.requestSubmit();
            }}
          />
          {!existing ? null : expiryPending ? (
            <p className="text-xs text-muted-foreground">Saving…</p>
          ) : isExpired ? (
            <p className="text-xs text-destructive">This license has expired — you&apos;ll need a current one to submit.</p>
          ) : null}
          {expiryState?.error ? <p className="text-xs text-destructive">{expiryState.error}</p> : null}
        </form>
      ) : null}

      {!existing || isRejected ? (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="docKey" value={slot.key} />
          <input type="hidden" name="docLabel" value={slot.label} />
          <input type="hidden" name="expiry" value={expiry} />
          <FileField
            name="file"
            accept="application/pdf"
            required
            autoSubmit
            validate={checkUploadFile}
            label={isRejected ? "Drop a replacement PDF" : "Drop a PDF"}
          />
        </form>
      ) : null}
      {state?.error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function StepDocuments({
  kind,
  application,
  reviews = {},
}: {
  kind: ApplicationKind;
  application: AppRow;
  reviews?: Record<string, DocumentReview>;
}) {
  const [state, formAction] = useActionState(advanceToReview, null);
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const slots = docSlotsFor(kind);
  const backStep = kind === "affiliate" ? 3 : 4;
  const { missingUpload, missingExpiry } = missingRequiredDocSlots(kind, refs);
  const rejectedDocs = slots.filter((slot) => reviews[slot.key]?.status === "rejected");

  return (
    <div className="space-y-4">
      {slots.map((slot, i) => (
        <DocUploadRow
          key={slot.key}
          kind={kind}
          applicationId={application.id}
          slot={slot}
          existing={refs.find((r) => r.key === slot.key)}
          review={reviews[slot.key]}
          iconIndex={i}
        />
      ))}
      {rejectedDocs.length > 0 ? (
        <Alert variant="destructive">
          <XCircle />
          <AlertDescription>
            Re-upload before you continue: {rejectedDocs.map((s) => s.label).join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}
      {missingUpload.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Still needed before you can continue: {missingUpload.map((s) => s.label).join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}
      {missingExpiry.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Set an expiry date before you can continue: {missingExpiry.map((s) => s.label).join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <StepNav
          backHref={`/account/become/${kind}/${application.id}?step=${backStep}`}
          nextLabel="Continue to Review"
          note="Your documents are secure and encrypted"
        />
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
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);
  const d = application.business_details;
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const { missingUpload, missingExpiry } = missingRequiredDocSlots(kind, refs);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{stepLabel(kind, 1)}</p>
          <Link href={`/account/become/${kind}/${application.id}?step=1`} className="text-xs text-primary hover:underline">
            Edit
          </Link>
        </div>
        {kind === "affiliate" ? (
          <>
            <SummaryRow label="Full name" value={d.fullName} />
            <SummaryRow label="City" value={d.city} />
            <SummaryRow
              label="Audience location"
              value={d.audienceLocation ? ((AUDIENCE_LOCATION_LABELS as Record<string, string>)[String(d.audienceLocation)] ?? String(d.audienceLocation)) : null}
            />
            <SummaryRow label="Mobile" value={d.mobile} />
            <SummaryRow label="Email" value={d.email} />
          </>
        ) : (
          <>
            <SummaryRow label="Legal business name" value={d.legalBusinessName} />
            <SummaryRow label="Trading name" value={d.tradingName} />
            <SummaryRow label="Business type" value={d.businessType} />
            <SummaryRow label="City" value={d.officeCity} />
            <SummaryRow label="Business phone" value={d.businessPhone} />
            <SummaryRow label="Business email" value={d.businessEmail} />
            <div className="flex items-center justify-between gap-4 py-1 text-sm">
              <span className="text-muted-foreground">Organization logo</span>
              {typeof d.logoPath === "string" && d.logoPath ? (
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={partnerLogoUrl(d.logoPath)!} alt="" className="size-full object-contain" />
                </span>
              ) : (
                <span className="text-right font-medium text-muted-foreground/50">Not added</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{stepLabel(kind, 2)}</p>
          <Link href={`/account/become/${kind}/${application.id}?step=2`} className="text-xs text-primary hover:underline">
            Edit
          </Link>
        </div>
        {kind === "affiliate" ? (
          <SummaryRow label="ID number" value={d.idNumber} />
        ) : (
          <>
            <SummaryRow label="Name" value={d.contactFullName} />
            <SummaryRow label="Role" value={d.contactRole} />
            <SummaryRow label="Mobile" value={d.contactMobile} />
          </>
        )}
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
        ) : kind === "venue_partner" ? (
          <>
            <SummaryRow label="Venue" value={d.venueName} />
            <SummaryRow label="Location" value={d.location} />
            <SummaryRow
              label="Capacity"
              value={
                d.standingCapacity
                  ? `${d.seatedCapacity ? `${d.seatedCapacity} seated · ` : ""}${d.standingCapacity} standing`
                  : null
              }
            />
            <SummaryRow label="Event types" value={d.eventTypes} />
            <SummaryRow label="Indicative price" value={d.indicativePrice ? `USD ${d.indicativePrice}` : null} />
          </>
        ) : (
          <>
            <SummaryRow label="Traffic source" value={d.trafficSource} />
            <SummaryRow label="Promotion plan" value={d.promotionPlan} />
          </>
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
          {kind === "hotel_partner" || kind === "venue_partner" ? (
            <SummaryRow label="Payout frequency" value={d.payoutFrequency ? PAYOUT_FREQUENCY_LABELS[String(d.payoutFrequency)] : null} />
          ) : (
            <>
              <SummaryRow label="Payment model" value={d.paymentModel === "credit_line" ? "Credit line" : "Prepaid wallet"} />
              <SummaryRow
                label="Markup"
                value={d.requestedMarkupPercent == null || d.requestedMarkupPercent === "" ? null : `${d.requestedMarkupPercent}%`}
              />
            </>
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
        {missingUpload.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle />
            <AlertDescription>
              Still needed before you can submit: {missingUpload.map((s) => s.label).join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}
        {missingExpiry.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle />
            <AlertDescription>
              Set an expiry date before you can submit: {missingExpiry.map((s) => s.label).join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
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
