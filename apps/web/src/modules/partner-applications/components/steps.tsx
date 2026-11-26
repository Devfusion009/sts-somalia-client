"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { applicantAnswer, NOT_PROVIDED_BY_APPLICANT } from "../answer-display";
import { DraftStep, useDraftCapture, type DraftApplication } from "./draft-step";
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
  Pencil,
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
import {
  checkUploadFile,
  step1AffiliateSchema,
  step1BusinessSchema,
  step2AffiliateSchema,
  step2ContactSchema,
  step3AffiliateSchema,
  step3AgencySchema,
  step3HotelSchema,
  step3VenueSchema,
  step4AgencySchema,
  step4HotelSchema,
} from "../schemas";
import { FieldErrorsProvider, WizardField, useFieldErrorCount, useFieldValidation } from "./wizard-field";
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
import type { DocumentRef, DocumentReview } from "../queries";
import { partnerLogoUrl } from "../logo-url";
import { FileField } from "@/components/ui/upload";

type AppRow = DraftApplication;

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
    // Autosave never goes through a real submit, so React never resets the form for it.
    if (!state?.error || state.autosave || !snapshot || !form) return;
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Button type="button" variant="outline" render={<Link href={backHref} />}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
          </Button>
        ) : (
          <span />
        )}
        {saving ? (
          <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving…
          </span>
        ) : saved ? (
          <span role="status" className="flex items-center gap-1 text-xs text-primary">
            <Check className="size-3" aria-hidden="true" /> Saved
          </span>
        ) : note ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" /> {note}
          </span>
        ) : null}
      </div>
      <SubmitButton name="intent" value="continue" pendingText="Saving…">
        {nextLabel} <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </SubmitButton>
    </div>
  );
}

/** Field problems are shown on the fields themselves; this carries their count and any error no field owns. */
function ErrorAlert({ state }: { state: ActionState }) {
  const fieldErrors = useFieldErrorCount();
  const message =
    fieldErrors > 0
      ? fieldErrors === 1
        ? "Fix 1 field to continue."
        : `Fix ${fieldErrors} fields to continue.`
      : state?.error && !state.autosave && !state.fieldErrors
        ? state.error
        : null;
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — business details (agency / hotel_partner) or "about you" (affiliate) */
/* -------------------------------------------------------------------------- */
export function StepBusiness(props: { kind: ApplicationKind; application: AppRow; backHref: string }) {
  return <DraftStep kind={props.kind} application={props.application} step={1}>{application => <BusinessFields {...props} application={application} />}</DraftStep>;
}

function BusinessFields({ kind, application, backHref }: { kind: ApplicationKind; application: AppRow; backHref: string }) {
  const [state, formAction] = useActionState(saveStep1, null);
  const d = application.business_details;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useDraftCapture(formRef);
  useRestoreOnError(formRef, state);
  const validation = useFieldValidation(formRef, kind === "affiliate" ? step1AffiliateSchema : step1BusinessSchema, state);

  if (kind === "affiliate") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
        <FieldErrorsProvider value={validation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={application.id} />
          <ErrorAlert state={state} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <WizardField name="fullName" label="Full name" required>
              <Input name="fullName" defaultValue={s(d.fullName)} required />
            </WizardField>
            <WizardField name="city" label="City" required>
              <LocationField name="city" defaultValue={s(d.city)} required />
            </WizardField>
            <WizardField name="mobile" label="Mobile number" required>
              <PhoneField name="mobile" defaultValue={s(d.mobile)} required />
            </WizardField>
            <WizardField name="email" label="Email" required>
              <Input name="email" type="email" defaultValue={s(d.email)} required />
            </WizardField>
            <WizardField name="audienceLocation" label="Where is your audience mainly based?" required className="sm:col-span-2">
              <OptionPicker
                name="audienceLocation"
                defaultValue={s(d.audienceLocation)}
                options={AUDIENCE_LOCATIONS.map((v) => ({ value: v, label: AUDIENCE_LOCATION_LABELS[v] }))}
             />
            </WizardField>
          </div>
          <StepNav backHref={backHref} />
        </FieldErrorsProvider>
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
      <FieldErrorsProvider value={validation}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WizardField name="legalBusinessName" label="Legal business name" required>
            <IconInput icon={Building2} name="legalBusinessName" defaultValue={s(d.legalBusinessName)} required />
          </WizardField>
          <WizardField name="tradingName" label="Trading name (if different)">
            <IconInput icon={Tag} name="tradingName" defaultValue={s(d.tradingName)} />
          </WizardField>
          <WizardField name="businessType" label="Business type" required className="sm:col-span-2">
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
          </WizardField>
          <WizardField name="yearEstablished" label="Year established" required>
            <YearField name="yearEstablished" defaultValue={s(d.yearEstablished)} min={EARLIEST_BUSINESS_YEAR} max={CURRENT_YEAR} required />
          </WizardField>
          <WizardField name="registrationNumber" label="Business registration number">
            <IconInput icon={FileBadge2} name="registrationNumber" defaultValue={s(d.registrationNumber)} />
          </WizardField>
          <WizardField name="taxId" label="Tax identification number">
            <IconInput icon={Receipt} name="taxId" defaultValue={s(d.taxId)} />
          </WizardField>
        </div>

        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <WizardField name="officeStreet" label="Office street address" className="sm:col-span-3">
            <IconInput icon={MapPinned} name="officeStreet" defaultValue={s(d.officeStreet)} />
          </WizardField>
          <WizardField name="officeCity" label="City" required>
            <LocationField name="officeCity" defaultValue={s(d.officeCity)} required />
          </WizardField>
          <WizardField name="officeRegion" label="Region">
            <Input name="officeRegion" defaultValue={s(d.officeRegion)} />
          </WizardField>
          <WizardField name="officeCountry" label="Country">
            <CountryField name="officeCountry" defaultValue={s(d.officeCountry) || "Somalia"} />
          </WizardField>
        </div>

        <WizardField name="branchesJson" label="Branch offices (optional)">
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
        </WizardField>

        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WizardField name="businessPhone" label="Business phone" required>
            <PhoneField name="businessPhone" defaultValue={s(d.businessPhone)} required />
          </WizardField>
          <WizardField name="businessEmail" label="Business email" required>
            <IconInput icon={Mail} name="businessEmail" type="email" defaultValue={s(d.businessEmail)} required />
          </WizardField>
          <WizardField name="website" label="Website (optional)" className="sm:col-span-2">
            <IconInput icon={Globe} name="website" defaultValue={s(d.website)} placeholder="https://" />
          </WizardField>
        </div>

        <StepNav backHref={backHref} />
      </FieldErrorsProvider>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — authorized contact (agency / hotel_partner) or identity verification (affiliate) */
/* -------------------------------------------------------------------------- */
export function StepContact(props: { kind: ApplicationKind; application: AppRow }) {
  return <DraftStep kind={props.kind} application={props.application} step={2}>{application => <ContactFields {...props} application={application} />}</DraftStep>;
}

function ContactFields({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction] = useActionState(saveStep2, null);
  const d = application.business_details;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useDraftCapture(formRef);
  useRestoreOnError(formRef, state);
  const validation = useFieldValidation(formRef, kind === "affiliate" ? step2AffiliateSchema : step2ContactSchema, state);

  if (kind === "affiliate") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
        <FieldErrorsProvider value={validation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={application.id} />
          <ErrorAlert state={state} />
          <WizardField name="idNumber" label="National ID or passport number" required>
            <Input name="idNumber" defaultValue={s(d.idNumber)} required />
          </WizardField>
          <StepNav backHref={`/account/become/${kind}/${application.id}?step=1`} />
        </FieldErrorsProvider>
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
      <FieldErrorsProvider value={validation}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WizardField name="contactFullName" label="Full name" required>
            <IconInput icon={User} name="contactFullName" defaultValue={s(d.contactFullName)} required />
          </WizardField>
          <WizardField name="contactRole" label="Role / title" required>
            <RoleField name="contactRole" defaultValue={s(d.contactRole)} />
          </WizardField>
          <WizardField name="contactIdNumber" label="National ID or passport number" required>
            <IconInput icon={IdCard} name="contactIdNumber" defaultValue={s(d.contactIdNumber)} required />
          </WizardField>
          <WizardField name="contactMobile" label="Mobile number" required>
            <PhoneField name="contactMobile" defaultValue={s(d.contactMobile)} required />
          </WizardField>
          <WizardField name="contactEmail" label="Email" required className="sm:col-span-2">
            <IconInput icon={Mail} name="contactEmail" type="email" defaultValue={s(d.contactEmail)} required />
          </WizardField>
        </div>

        <StepNav backHref={`/account/become/${kind}/${application.id}?step=1`} />
      </FieldErrorsProvider>
    </form>
  );
}

function AmenitiesField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <WizardField name="amenities" label="Amenities & facilities">
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
    </WizardField>
  );
}

function ProductsField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <WizardField name="products" label="Products you intend to book">
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
    </WizardField>
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
      <WizardField name="isOrgMember" label="Member of a travel trade association?">
        <OptionPicker
          name="isOrgMember"
          defaultValue={isMember}
          onChange={setIsMember}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
       />
      </WizardField>
      {isMember === "yes" ? (
        <>
          <WizardField name="orgMemberType" label="Association">
            <OptionPicker
              name="orgMemberType"
              defaultValue={initialType}
              options={ORG_MEMBER_TYPES.map((t) => ({ value: t, label: ORG_MEMBER_TYPE_LABELS[t] }))}
           />
          </WizardField>
          <WizardField name="iataNumber" label="Membership number">
            <Input name="iataNumber" defaultValue={initialNumber} />
          </WizardField>
        </>
      ) : null}
    </div>
  );
}

function VenueEventTypesField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <WizardField name="eventTypes" label="Events your venue hosts">
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
    </WizardField>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — type-specific operations                                          */
/* -------------------------------------------------------------------------- */
export function StepOperations(props: { kind: ApplicationKind; application: AppRow }) {
  return <DraftStep kind={props.kind} application={props.application} step={3}>{application => <OperationsFields {...props} application={application} />}</DraftStep>;
}

function OperationsFields({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction] = useActionState(saveStep3, null);
  const d = application.business_details;
  const backHref = `/account/become/${kind}/${application.id}?step=2`;
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useDraftCapture(formRef);
  useRestoreOnError(formRef, state);
  const validation = useFieldValidation(
    formRef,
    kind === "hotel_partner"
      ? step3HotelSchema
      : kind === "venue_partner"
        ? step3VenueSchema
        : kind === "affiliate"
          ? step3AffiliateSchema
          : step3AgencySchema,
    state
  );

  if (kind === "hotel_partner") {
    const initialRoomTypes = Array.isArray(d.roomTypes) ? (d.roomTypes as RoomTypeRow[]) : [];
    const initialAmenities = Array.isArray(d.amenities) ? (d.amenities as string[]) : [];
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
        <FieldErrorsProvider value={validation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={application.id} />
          <ErrorAlert state={state} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <WizardField name="propertyType" label="Property type" required>
              <OptionPicker
                name="propertyType"
                defaultValue={s(d.propertyType)}
                options={PROPERTY_TYPES.map((t) => ({ value: t, label: PROPERTY_TYPE_LABELS[t] }))}
             />
            </WizardField>
            <WizardField name="starRating" label="Star rating" required>
              <OptionPicker
                name="starRating"
                defaultValue={s(d.starRating)}
                options={STAR_RATINGS.map((r) => ({ value: r, label: STAR_RATING_LABELS[r] }))}
             />
            </WizardField>
            <WizardField name="propertyName" label="Property name" required className="sm:col-span-2">
              <Input name="propertyName" defaultValue={s(d.propertyName)} required />
            </WizardField>
          </div>

          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <WizardField name="propertyStreet" label="Property street address" className="sm:col-span-3">
              <Input name="propertyStreet" defaultValue={s(d.propertyStreet)} placeholder="Distinct from your office address, if different" />
            </WizardField>
            <WizardField name="location" label="City" required className="sm:col-span-2">
              <LocationField name="location" defaultValue={s(d.location)} required />
            </WizardField>
            <WizardField name="totalRooms" label="Total rooms / units" required>
              <Input name="totalRooms" type="number" min="1" defaultValue={s(d.totalRooms)} required />
            </WizardField>
          </div>

          <Separator />
          <RoomTypesField initial={initialRoomTypes} />

          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <WizardField name="checkInTime" label="Check-in time" required>
              <AnalogTimeField name="checkInTime" defaultValue={s(d.checkInTime) || "14:00"} required />
            </WizardField>
            <WizardField name="checkOutTime" label="Check-out time" required>
              <AnalogTimeField name="checkOutTime" defaultValue={s(d.checkOutTime) || "12:00"} required />
            </WizardField>
            <WizardField name="cancellationPolicy" label="Cancellation policy" required className="sm:col-span-2">
              <OptionPicker
                name="cancellationPolicy"
                defaultValue={s(d.cancellationPolicy)}
                layout="stack"
                options={CANCELLATION_POLICIES.map((c) => ({ value: c, ...CANCELLATION_POLICY_LABELS[c] }))}
             />
            </WizardField>
          </div>

          <Separator />
          <AmenitiesField initial={initialAmenities} />

          <StepNav backHref={backHref} />
        </FieldErrorsProvider>
      </form>
    );
  }

  if (kind === "venue_partner") {
    const initialEventTypes = Array.isArray(d.eventTypes) ? (d.eventTypes as string[]) : [];
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
        <FieldErrorsProvider value={validation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={application.id} />
          <ErrorAlert state={state} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <WizardField name="venueName" label="Venue name" required>
              <Input name="venueName" defaultValue={s(d.venueName)} required />
            </WizardField>
            <WizardField name="location" label="Location / city" required>
              <LocationField name="location" defaultValue={s(d.location)} required />
            </WizardField>
            <WizardField name="seatedCapacity" label="Seated capacity">
              <Input name="seatedCapacity" type="number" min="1" defaultValue={s(d.seatedCapacity)} placeholder="e.g. 300" />
            </WizardField>
            <WizardField name="standingCapacity" label="Standing capacity" required>
              <Input name="standingCapacity" type="number" min="1" defaultValue={s(d.standingCapacity)} placeholder="e.g. 500" required />
            </WizardField>
            <WizardField name="indicativePrice" label="Indicative price (USD, optional)" className="sm:col-span-2">
              <Input name="indicativePrice" type="number" min="0" defaultValue={s(d.indicativePrice)} placeholder="e.g. 1500 per event" />
            </WizardField>
          </div>
          <VenueEventTypesField initial={initialEventTypes} />
          <StepNav backHref={backHref} />
        </FieldErrorsProvider>
      </form>
    );
  }

  if (kind === "affiliate") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
        <FieldErrorsProvider value={validation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={application.id} />
          <ErrorAlert state={state} />
          <WizardField name="handlesJson" label="Website / social handles">
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
          </WizardField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <WizardField name="audienceSize" label="Audience size">
              <Input name="audienceSize" type="number" min="0" defaultValue={s(d.audienceSize)} placeholder="e.g. 15000" />
            </WizardField>
            <WizardField name="trafficSource" label="Primary traffic source" required>
              <OptionPicker
                name="trafficSource"
                defaultValue={s(d.trafficSource)}
                options={TRAFFIC_SOURCES.map((t) => ({ value: t, label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
             />
            </WizardField>
          </div>
          <WizardField name="promotionPlan" label="How do you plan to promote STS Somalia?" required>
            <Textarea
              name="promotionPlan"
              rows={3}
              defaultValue={s(d.promotionPlan)}
              placeholder="e.g. I post Umrah travel tips to my Instagram followers and share deals in a Somali diaspora WhatsApp group."
              required
           />
          </WizardField>
          <StepNav backHref={backHref} />
        </FieldErrorsProvider>
      </form>
    );
  }

  // agency
  const initialProducts = Array.isArray(d.products) ? (d.products as string[]) : [];
  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
      <FieldErrorsProvider value={validation}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WizardField name="yearsExperience" label="Years of experience in travel">
            <BucketPicker
              name="yearsExperience"
              defaultValue={s(d.yearsExperience)}
              options={["<1", "1-2", "3-5", "5-10", "10+"]}
              customPlaceholder="Exact years"
           />
          </WizardField>
          <WizardField name="staffCount" label="Number of staff using the platform">
            <BucketPicker
              name="staffCount"
              defaultValue={s(d.staffCount)}
              options={["1", "2-5", "5-10", "10+"]}
              customPlaceholder="Exact headcount"
           />
          </WizardField>
          <WizardField name="monthlyVolume" label="Estimated monthly booking volume" required className="sm:col-span-2">
            <OptionPicker
              name="monthlyVolume"
              defaultValue={s(d.monthlyVolume)}
              options={VOLUME_RANGES.map((r) => ({ value: r, label: r }))}
           />
          </WizardField>
        </div>
        <Separator />
        <OrgMemberField initialIsMember={s(d.isOrgMember)} initialType={s(d.orgMemberType)} initialNumber={s(d.iataNumber)} />
        <Separator />
        <ProductsField initial={initialProducts} />
        <StepNav backHref={backHref} />
      </FieldErrorsProvider>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 4 — settlement                                                        */
/* -------------------------------------------------------------------------- */
export function StepSettlement(props: { kind: ApplicationKind; application: AppRow }) {
  return <DraftStep kind={props.kind} application={props.application} step={4}>{application => <SettlementFields {...props} application={application} />}</DraftStep>;
}

function SettlementFields({ kind, application }: { kind: ApplicationKind; application: AppRow }) {
  const [state, formAction] = useActionState(saveStep4, null);
  const d = application.business_details;
  const [paymentModel, setPaymentModel] = useState(s(d.paymentModel) || "prepaid_wallet");
  const savedMarkup = d.requestedMarkupPercent == null || d.requestedMarkupPercent === "" ? null : Number(d.requestedMarkupPercent);
  const savedMarkupIsPreset = savedMarkup !== null && MARKUP_PRESETS.includes(savedMarkup);
  const [markupPreset, setMarkupPreset] = useState(typeof d.requestedMarkupPreset === "string" ? d.requestedMarkupPreset : savedMarkup === null ? "" : savedMarkupIsPreset ? String(savedMarkup) : "custom");
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useDraftCapture(formRef);
  useRestoreOnError(formRef, state);
  const validation = useFieldValidation(
    formRef,
    kind === "hotel_partner" || kind === "venue_partner" ? step4HotelSchema : step4AgencySchema,
    state
  );
  const backHref = `/account/become/${kind}/${application.id}?step=3`;

  // A hotel or venue is a supplier: it's paid out for completed stays/events,
  // not billed — so instead of the agency's "how you'll pay us" wallet/
  // credit-line choice, it only picks a payout cadence, and bank details are
  // mandatory (they're the whole point of this step for a supplier).
  if (kind === "hotel_partner" || kind === "venue_partner") {
    return (
      <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
        <FieldErrorsProvider value={validation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="applicationId" value={application.id} />
          <ErrorAlert state={state} />

          <WizardField name="payoutFrequency" label="Payout frequency" required>
            <OptionPicker
              name="payoutFrequency"
              defaultValue={s(d.payoutFrequency)}
              options={PAYOUT_FREQUENCIES.map((f) => ({ value: f, label: PAYOUT_FREQUENCY_LABELS[f] }))}
           />
          </WizardField>

          <Separator />
          <p className="text-sm font-semibold">Payout bank account</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <WizardField name="bankName" label="Bank name" required>
              <IconInput icon={Landmark} name="bankName" defaultValue={s(d.bankName)} required />
            </WizardField>
            <WizardField name="bankAccountName" label="Account name" required>
              <IconInput icon={User} name="bankAccountName" defaultValue={s(d.bankAccountName)} required />
            </WizardField>
            <WizardField name="bankAccountNumber" label="Account number" required>
              <IconInput icon={Hash} name="bankAccountNumber" defaultValue={s(d.bankAccountNumber)} required />
            </WizardField>
          </div>

          <StepNav backHref={backHref} />
        </FieldErrorsProvider>
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} onChange={autosave} onClick={autosave} noValidate className="space-y-5">
      <FieldErrorsProvider value={validation}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />

        <WizardField name="paymentModel" label="Preferred payment model" required>
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
        </WizardField>

        {paymentModel === "credit_line" ? (
          <WizardField name="estimatedMonthlyVolume" label="Estimated monthly volume (to help size your limit)">
            <Input name="estimatedMonthlyVolume" defaultValue={s(d.estimatedMonthlyVolume)} placeholder="e.g. USD 5,000" />
          </WizardField>
        ) : null}

        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WizardField name="requestedMarkupPreset" label="Your markup on STS net prices" required htmlFor="requestedMarkupPreset">
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
          </WizardField>
          {markupPreset === "custom" ? (
            <WizardField name="requestedMarkupCustom" label="Custom markup (%)" required htmlFor="requestedMarkupCustom">
              <Input
                id="requestedMarkupCustom"
                name="requestedMarkupCustom"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={typeof d.requestedMarkupCustom === "string" ? d.requestedMarkupCustom : savedMarkup !== null && !savedMarkupIsPreset ? String(savedMarkup) : ""}
                required
             />
            </WizardField>
          ) : null}
        </div>

        <Separator />
        <p className="text-sm font-semibold">Bank account</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <WizardField name="bankName" label="Bank name">
            <IconInput icon={Landmark} name="bankName" defaultValue={s(d.bankName)} />
          </WizardField>
          <WizardField name="bankAccountName" label="Account name">
            <IconInput icon={User} name="bankAccountName" defaultValue={s(d.bankAccountName)} />
          </WizardField>
          <WizardField name="bankAccountNumber" label="Account number">
            <IconInput icon={Hash} name="bankAccountNumber" defaultValue={s(d.bankAccountNumber)} />
          </WizardField>
        </div>

        <Separator />
        <WizardField name="remarks" label="Remarks">
          <Textarea name="remarks" rows={3} defaultValue={s(d.remarks)} />
        </WizardField>

        <StepNav backHref={backHref} />
      </FieldErrorsProvider>
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
              <DropdownMenuTrigger
                render={<Button type="button" variant="ghost" size="icon" aria-label={`${slot.label} actions`} />}
              >
                <MoreVertical className="size-4" aria-hidden="true" />
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
            <p role="alert" className="text-xs text-destructive">Expired.</p>
          ) : null}
          {expiryState?.error ? <p role="alert" className="text-xs text-destructive">{expiryState.error}</p> : null}
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
            Re-upload: {rejectedDocs.map((s) => s.label).join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}
      {missingUpload.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Missing: {missingUpload.map((s) => s.label).join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}
      {missingExpiry.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Expiry date needed: {missingExpiry.map((s) => s.label).join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <StepNav
          backHref={`/account/become/${kind}/${application.id}?step=${backStep}`}
          nextLabel="Continue to review"
       />
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 6 — review & submit                                                   */
/* -------------------------------------------------------------------------- */
function EditStepLink({ kind, applicationId, step }: { kind: ApplicationKind; applicationId: string; step: number }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Edit ${stepLabel(kind, step)}`}
      title="Edit"
      render={<Link href={`/account/become/${kind}/${applicationId}?step=${step}`} />}
    >
      <Pencil />
    </Button>
  );
}

function SummaryRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? (value as unknown[]).map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ") : String(value);
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", display === NOT_PROVIDED_BY_APPLICANT ? "font-normal text-muted-foreground" : "font-medium")}>{display}</span>
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
      <div className="rounded-xl bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{stepLabel(kind, 1)}</p>
          <EditStepLink kind={kind} applicationId={application.id} step={1} />
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
            <SummaryRow label="Trading name" value={applicantAnswer(d.tradingName)} />
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

      <div className="rounded-xl bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{stepLabel(kind, 2)}</p>
          <EditStepLink kind={kind} applicationId={application.id} step={2} />
        </div>
        {kind === "affiliate" ? (
          <SummaryRow label="ID number" value={d.idNumber} />
        ) : (
          <>
            <SummaryRow label="Name" value={d.contactFullName} />
            <SummaryRow label="Role" value={d.contactRole} />
            <SummaryRow label="Mobile" value={d.contactMobile} />
            <SummaryRow label={kind === "agency" ? "Credential email" : "Email"} value={d.contactEmail} />
          </>
        )}
      </div>

      <div className="rounded-xl bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{stepLabel(kind, 3)}</p>
          <EditStepLink kind={kind} applicationId={application.id} step={3} />
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
        <div className="rounded-xl bg-muted/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Settlement</p>
            <EditStepLink kind={kind} applicationId={application.id} step={4} />
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

      <div className="rounded-xl bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Documents ({refs.length})</p>
          <EditStepLink kind={kind} applicationId={application.id} step={5} />
        </div>
        {refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {refs.map((r) => (
              <li key={r.key} className="flex items-center gap-1.5 text-muted-foreground">
                <FileCheck2 className="size-3.5 text-primary" aria-hidden="true" /> {r.label}
              </li>
            ))}
          </ul>
        )}
        {missingUpload.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle />
            <AlertDescription>
              Missing: {missingUpload.map((s) => s.label).join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}
        {missingExpiry.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle />
            <AlertDescription>
              Expiry date needed: {missingExpiry.map((s) => s.label).join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="applicationId" value={application.id} />
        <ErrorAlert state={state} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeTerms" required className="mt-0.5 size-4 shrink-0 accent-primary" />
          <span>
            I agree to the STS Somalia{" "}
            <Link href="/partner-terms" className="font-medium text-primary hover:underline" target="_blank">
              Partner Terms &amp; Conditions
            </Link>
            .
          </span>
        </label>
        <StepNav backHref={`/account/become/${kind}/${application.id}?step=5`} nextLabel="Submit application" />
      </form>
    </div>
  );
}
