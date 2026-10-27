"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { countryName } from "@/lib/countries";
import { fmtMoney } from "@/modules/visa/components/visa-shared";
import {
  saveApplicantType,
  saveVisaMember,
  removeVisaMember,
  savePersonalInfo,
  saveTravelInfo,
  uploadVisaDocument,
  attachVaultDocument,
  removeVisaDocument,
  continueFromDocuments,
  submitVisaApplication,
  type ActionState,
} from "@/modules/visa/actions";
import { RELATIONSHIPS, parseDocumentSlots, parseApplicationQuestions, todayIso, type DocumentSlot } from "@/modules/visa/schemas";
import type { WizardApplication } from "@/modules/visa/queries";
import { FileField } from "@/components/ui/upload";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

const GENDER_LABELS: Record<string, string> = { male: "Male", female: "Female" };

const PURPOSE_OPTIONS = [
  { value: "tourism", label: "Tourism" },
  { value: "business", label: "Business" },
  { value: "family_visit", label: "Family visit" },
  { value: "medical", label: "Medical" },
  { value: "transit", label: "Transit" },
  { value: "umrah", label: "Umrah" },
  { value: "other", label: "Other" },
];
const PURPOSE_LABELS: Record<string, string> = Object.fromEntries(PURPOSE_OPTIONS.map((o) => [o.value, o.label]));

/* ------------------------------------------------------------------------- */
/* Shared bits                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Desk (agent-portal) step submissions come back with a destination instead
 * of a server redirect — see advanceWizard() in actions.ts for why a
 * redirect() can't be trusted to land on the agent host. A plain assignment,
 * not router.push(), for the same reason PayFromWalletForm uses one: it
 * always resolves against the actual current origin.
 */
function useDeskNavigate(state: ActionState) {
  useEffect(() => {
    if (state?.destination) window.location.href = state.destination;
  }, [state]);
}

/** The wizard's own host path — desk pages are re-hosted, not forked, so every intra-wizard link derives from the same single switch. */
function wizardBasePath(desk: boolean) {
  return desk ? "/agent/book/visa/apply" : "/visa/apply";
}

/** `index` is kept for callers; the stepper beside the form already shows the step number. */
function StepHeading({ title }: { index?: number; title: string }) {
  return <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>;
}

/** Back on the left, primary on the right; stacked full-width on phones (primary first). */
const STEP_FOOTER =
  "flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between max-sm:[&>*]:w-full";

function ErrorAlert({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

function BackButton({ href }: { href: string }) {
  return (
    <Button variant="outline" size="lg" render={<Link href={href} />} className="gap-2">
      <ArrowLeft className="size-4" aria-hidden /> Back
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

/** Options-driven select whose trigger shows the label (not the raw value). */
function LabeledSelect({
  name,
  defaultValue,
  placeholder,
  options,
  id,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  id?: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue || undefined} items={options}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: "Self",
  spouse: "Spouse",
  son: "Son",
  daughter: "Daughter",
  father: "Father",
  mother: "Mother",
  brother: "Brother",
  sister: "Sister",
  grandfather: "Grandfather",
  grandmother: "Grandmother",
  other: "Other relative",
};

/* ------------------------------------------------------------------------- */
/* Step 1 — applicant type + members                                          */
/* ------------------------------------------------------------------------- */

const APPLICANT_TYPE_CARDS = [
  {
    value: "single",
    icon: User,
    title: "Single applicant",
    description: "Only myself",
  },
  {
    value: "family",
    icon: Users,
    title: "Family",
    description: "Me and my family members",
  },
  {
    value: "group",
    icon: UsersRound,
    title: "Group",
    description: "Me and a group (not family)",
  },
] as const;

function MemberDialog({
  applicationId,
  member,
  trigger,
}: {
  applicationId: string;
  member?: WizardApplication["members"][number];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveVisaMember, null);
  const lastState = useRef<ActionState>(null);

  useEffect(() => {
    if (state !== lastState.current && state && state.error === null) setOpen(false);
    lastState.current = state;
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add member"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          {member ? <input type="hidden" name="memberId" value={member.id} /> : null}
          <Field label="Full name (as in passport)" htmlFor={`member-name-${member?.id ?? "new"}`} required className="sm:col-span-2">
            <Input
              id={`member-name-${member?.id ?? "new"}`}
              name="fullName"
              defaultValue={member?.full_name ?? ""}
              placeholder="Enter full name"
              required
            />
          </Field>
          <Field label="Relationship" htmlFor={`member-rel-${member?.id ?? "new"}`} required>
            <LabeledSelect
              id={`member-rel-${member?.id ?? "new"}`}
              name="relationship"
              defaultValue={member?.relationship}
              placeholder="Select relationship"
              options={RELATIONSHIPS.filter((r) => r !== "self").map((rel) => ({
                value: rel,
                label: RELATIONSHIP_LABELS[rel],
              }))}
            />
          </Field>
          <Field label="Date of birth" htmlFor={`member-dob-${member?.id ?? "new"}`} required>
            <Input
              id={`member-dob-${member?.id ?? "new"}`}
              name="dateOfBirth"
              type="date"
              max={todayIso()}
              defaultValue={member?.date_of_birth ?? ""}
              required
            />
          </Field>
          <Field label="Nationality" htmlFor={`member-nat-${member?.id ?? "new"}`} required>
            <CountrySearchSelect
              id={`member-nat-${member?.id ?? "new"}`}
              name="nationality"
              defaultValue={member?.nationality ?? undefined}
              placeholder="Select nationality"
            />
          </Field>
          <Field label="Passport number" htmlFor={`member-passport-${member?.id ?? "new"}`} required>
            <Input
              id={`member-passport-${member?.id ?? "new"}`}
              name="passportNumber"
              defaultValue={member?.passport_number ?? ""}
              placeholder="Enter passport number"
              required
            />
          </Field>
          <Field label="Passport expiry date" htmlFor={`member-expiry-${member?.id ?? "new"}`}>
            <Input
              id={`member-expiry-${member?.id ?? "new"}`}
              name="passportExpiry"
              type="date"
              min={todayIso()}
              defaultValue={member?.passport_expiry ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <ErrorAlert state={state} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{member ? "Save changes" : "Add member"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StepApplicantType({
  application,
  backHref,
  desk = false,
}: {
  application: WizardApplication;
  backHref: string;
  /** Agent-desk host — see advanceWizard() in actions.ts. */
  desk?: boolean;
}) {
  const [state, formAction] = useActionState(saveApplicantType, null);
  useDeskNavigate(state);
  const [applicantType, setApplicantType] = useState(application.applicant_type);
  const members = application.members;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <StepHeading index={1} title="Applicant type" />
        <div role="radiogroup" aria-label="Applicant type" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {APPLICANT_TYPE_CARDS.map((card) => {
            const active = applicantType === card.value;
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setApplicantType(card.value)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-col sm:gap-2 sm:p-6 sm:text-center",
                  active
                    ? "border-primary shadow-sm ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full sm:size-12",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                  aria-hidden
                >
                  <card.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 sm:flex-none">
                  <span className="block text-sm font-bold">{card.title}</span>
                  <span className="block text-xs text-muted-foreground">{card.description}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2 sm:mt-1",
                    active ? "border-primary" : "border-muted-foreground/40"
                  )}
                >
                  {active ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {applicantType !== "single" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StepHeading title={applicantType === "family" ? "Family details" : "Group details"} />
            <MemberDialog
              applicationId={application.id}
              trigger={
                <Button className="gap-1.5">
                  <Plus className="size-4" aria-hidden /> Add member
                </Button>
              }
            />
          </div>

          {members.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Full name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Date of birth</TableHead>
                    <TableHead>Passport no.</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member, i) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <span className="block text-sm font-medium">{member.full_name}</span>
                        {member.is_primary ? (
                          <Badge variant="info" className="mt-0.5">
                            Primary applicant
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="capitalize">
                        {RELATIONSHIP_LABELS[member.relationship] ?? member.relationship}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {member.date_of_birth ? format(parseISO(member.date_of_birth), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {member.passport_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center justify-end gap-1">
                          <MemberDialog
                            applicationId={application.id}
                            member={member}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Edit ${member.full_name}`}>
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                            }
                          />
                          {!member.is_primary ? (
                            <form action={removeVisaMember}>
                              <input type="hidden" name="memberId" value={member.id} />
                              <input type="hidden" name="applicationId" value={application.id} />
                              <ConfirmButton
                                title="Remove this traveller?"
                                description={member.full_name}
                                confirmLabel="Remove"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${member.full_name}`}
                              >
                                <Trash2 className="size-4 text-destructive" aria-hidden />
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No members yet.
            </p>
          )}
        </section>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="applicantType" value={applicantType} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        <ErrorAlert state={state} />
        <div className={STEP_FOOTER}>
          <BackButton href={backHref} />
          <SubmitButton size="lg" pendingText="Saving…" className="gap-2">
            Continue <ArrowRight className="size-4" aria-hidden />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 2 — personal information                                              */
/* ------------------------------------------------------------------------- */

export function StepPersonalInfo({
  application,
  desk = false,
}: {
  application: WizardApplication;
  /** Agent-desk host — see advanceWizard() in actions.ts. */
  desk?: boolean;
}) {
  const [state, formAction] = useActionState(savePersonalInfo, null);
  useDeskNavigate(state);
  const t = (application.traveler_details ?? {}) as Record<string, string>;
  const c = (application.contact_details ?? {}) as Record<string, string>;
  // After a validation error, prefer what the user just typed over saved data.
  const v = state?.values ?? {};

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="applicationId" value={application.id} />
      {desk ? <input type="hidden" name="desk" value="1" /> : null}
      <StepHeading index={2} title="Personal information" />

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Full name (as in passport)" htmlFor="fullName" required className="sm:col-span-2">
          <Input id="fullName" name="fullName" defaultValue={v.fullName ?? t.full_name ?? ""} placeholder="Enter full name" required />
        </Field>
        <Field label="Date of birth" htmlFor="dateOfBirth" required>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" max={todayIso()} defaultValue={v.dateOfBirth ?? t.date_of_birth ?? ""} required />
        </Field>
        <Field label="Gender" htmlFor="gender" required>
          <LabeledSelect
            id="gender"
            name="gender"
            defaultValue={v.gender ?? t.gender}
            placeholder="Select gender"
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </Field>
        <Field label="Nationality" htmlFor="nationality" required>
          <CountrySearchSelect id="nationality" name="nationality" defaultValue={v.nationality ?? t.nationality ?? undefined} placeholder="Select nationality" />
        </Field>
        <Field label="Passport number" htmlFor="passportNumber" required>
          <Input id="passportNumber" name="passportNumber" defaultValue={v.passportNumber ?? t.passport_number ?? ""} placeholder="Enter passport number" required />
        </Field>
        <Field label="Passport expiry date" htmlFor="passportExpiry" required>
          <Input id="passportExpiry" name="passportExpiry" type="date" min={todayIso()} defaultValue={v.passportExpiry ?? t.passport_expiry ?? ""} required />
        </Field>
        <Field label="Email address" htmlFor="email" required>
          <Input id="email" name="email" type="email" defaultValue={v.email ?? c.email ?? ""} placeholder="Enter email address" required />
        </Field>
        <Field label="Mobile number" htmlFor="mobile" required className="sm:col-span-2">
          <PhoneInput
            id="mobile"
            name="mobile"
            defaultValue={v.mobile ?? c.mobile ?? ""}
            defaultCountry={v.nationality ?? t.nationality ?? "SO"}
            placeholder="61 XXXXXXX"
            required
          />
        </Field>
      </div>

      <ErrorAlert state={state} />

      <div className={STEP_FOOTER}>
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=1`} />
        <SubmitButton size="lg" pendingText="Saving…" className="gap-2">
          Continue <ArrowRight className="size-4" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 3 — travel information                                                */
/* ------------------------------------------------------------------------- */

function YesNo({ name, label, defaultValue }: { name: string; label: string; defaultValue: "yes" | "no" }) {
  const [value, setValue] = useState<"yes" | "no">(defaultValue);
  const labelId = `${name}-label`;
  return (
    <div className="space-y-2">
      <Label id={labelId}>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
        {(["yes", "no"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => setValue(option)}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              value === option ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 items-center justify-center rounded-full border-2",
                value === option ? "border-primary" : "border-muted-foreground/40"
              )}
            >
              {value === option ? <span className="size-2 rounded-full bg-primary" /> : null}
            </span>
            {option === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StepTravelInfo({
  application,
  destination,
  desk = false,
}: {
  application: WizardApplication;
  destination: string;
  /** Agent-desk host — see advanceWizard() in actions.ts. */
  desk?: boolean;
}) {
  const [state, formAction] = useActionState(saveTravelInfo, null);
  useDeskNavigate(state);
  const t = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const v = state?.values ?? {};
  const str = (key: string) => (typeof t[key] === "string" ? (t[key] as string) : "");
  const questions = parseApplicationQuestions(application.visa_type?.application_questions);
  const answers = (application.custom_answers ?? {}) as Record<string, string>;

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="applicationId" value={application.id} />
      {desk ? <input type="hidden" name="desk" value="1" /> : null}
      <StepHeading index={3} title="Travel information" />

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label={`Arrival in ${destination}`} htmlFor="arrivalDate" required>
          <Input id="arrivalDate" name="arrivalDate" type="date" min={todayIso()} defaultValue={v.arrivalDate ?? str("arrival_date")} required />
        </Field>
        <Field label={`Departure from ${destination}`} htmlFor="departureDate" required>
          <Input id="departureDate" name="departureDate" type="date" min={todayIso()} defaultValue={v.departureDate ?? str("departure_date")} required />
        </Field>
        <Field label="Purpose of visit" htmlFor="purposeOfVisit" required className="sm:col-span-2">
          <LabeledSelect
            id="purposeOfVisit"
            name="purposeOfVisit"
            defaultValue={v.purposeOfVisit ?? str("purpose")}
            placeholder="Select purpose of visit"
            options={PURPOSE_OPTIONS}
          />
        </Field>
      </div>

      <Field label={`Address in ${destination} (hotel or contact)`} htmlFor="addressAtDestination" required>
        <Textarea
          id="addressAtDestination"
          name="addressAtDestination"
          rows={2}
          defaultValue={v.addressAtDestination ?? str("address")}
          placeholder={`Hotel name or contact address in ${destination}`}
          required
        />
      </Field>

      {questions.length > 0 ? (
        <div className="space-y-5 border-t border-border pt-5">
          <h3 className="font-heading text-base font-bold">Additional questions for {destination}</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {questions.map((q) => {
              const fieldName = `answer_${q.key}`;
              const existing = v[fieldName] ?? answers[q.key] ?? "";
              if (q.type === "yesno") {
                return (
                  <YesNo
                    key={q.key}
                    name={fieldName}
                    label={q.label}
                    defaultValue={existing === "yes" ? "yes" : "no"}
                  />
                );
              }
              if (q.type === "select") {
                return (
                  <Field key={q.key} label={q.label} htmlFor={fieldName} required={q.required}>
                    <LabeledSelect
                      id={fieldName}
                      name={fieldName}
                      defaultValue={existing}
                      placeholder="Select an option"
                      options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
                    />
                  </Field>
                );
              }
              return (
                <Field key={q.key} label={q.label} htmlFor={fieldName} required={q.required}>
                  <Input id={fieldName} name={fieldName} defaultValue={existing} required={q.required} />
                </Field>
              );
            })}
          </div>
        </div>
      ) : null}

      <ErrorAlert state={state} />

      <div className={STEP_FOOTER}>
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=2`} />
        <SubmitButton size="lg" pendingText="Saving…" className="gap-2">
          Continue <ArrowRight className="size-4" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 4 — document upload                                                   */
/* ------------------------------------------------------------------------- */

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One saved vault document, reduced to what the picker needs. */
export type VaultOption = {
  id: string;
  label: string;
  fileName: string;
  documentType: string;
};

function UploadSlot({
  applicationId,
  slot,
  existing,
  vaultOptions,
}: {
  applicationId: string;
  slot: DocumentSlot;
  existing?: WizardApplication["documents"][number];
  vaultOptions: VaultOption[];
}) {
  const [state, formAction] = useActionState(uploadVisaDocument, null);
  const [attachState, attachAction, attaching] = useActionState(attachVaultDocument, null);

  // Documents whose saved type matches this slot float to the top; the rest
  // stay selectable because slot keys are per-visa-type free text and won't
  // always line up with the vault's fixed vocabulary.
  const ranked = [...vaultOptions].sort((a, b) => {
    const aMatch = a.documentType === slot.key ? 0 : 1;
    const bMatch = b.documentType === slot.key ? 0 : 1;
    return aMatch - bMatch || a.label.localeCompare(b.label);
  });

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">
        {slot.label}
        {slot.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </p>
      {slot.description ? <p className="text-xs text-muted-foreground">{slot.description}</p> : null}

      {existing ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{existing.file_name ?? slot.label}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {[formatBytes(existing.file_size), "Uploaded"].filter(Boolean).join(" · ")}
            </p>
          </div>
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
          <form action={removeVisaDocument}>
            <input type="hidden" name="documentId" value={existing.id} />
            <input type="hidden" name="applicationId" value={applicationId} />
            <ConfirmButton
              title="Remove this document?"
              description={existing.file_name ?? slot.label}
              confirmLabel="Remove"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${slot.label}`}
            >
              <X className="size-4" aria-hidden />
            </ConfirmButton>
          </form>
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="slotKey" value={slot.key} />
          <FileField
            name="file"
            accept=".jpg,.jpeg,.png,.pdf"
            maxBytes={(slot.max_mb ?? 5) * 1024 * 1024}
            autoSubmit
            label="Drop JPG, PNG or PDF"
          />
          {state?.error ? (
            <p role="alert" className="mt-1.5 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </form>
      )}

      {/* Reuse from the vault. Only offered when the slot is empty and the
          customer actually has something saved — an empty picker would just be
          a dead control on every application. */}
      {!existing && ranked.length > 0 ? (
        <form action={attachAction} className="flex flex-wrap items-center gap-2 pt-1">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="slotKey" value={slot.key} />
          <label className="sr-only" htmlFor={`vault-${slot.key}`}>
            Use a saved document for {slot.label}
          </label>
          <select
            id={`vault-${slot.key}`}
            name="documentId"
            defaultValue=""
            required
            className={cn(NATIVE_SELECT_CLASS, "w-auto flex-1")}
          >
            <option value="" disabled>
              Use a document from your vault…
            </option>
            {ranked.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" loading={attaching}>
            Attach
          </Button>
          {attachState?.error ? (
            <p role="alert" className="w-full text-sm text-destructive">
              {attachState.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function StepDocuments({
  application,
  vaultOptions = [],
  desk = false,
}: {
  application: WizardApplication;
  /** The customer's document vault, offered as an alternative to uploading. */
  vaultOptions?: VaultOption[];
  /** Agent-desk host — see advanceWizard() in actions.ts. */
  desk?: boolean;
}) {
  const [state, formAction] = useActionState(continueFromDocuments, null);
  useDeskNavigate(state);
  const slots = parseDocumentSlots(application.resolved_documents ?? application.visa_type?.required_documents);
  const byKey = new Map(application.documents.map((d) => [d.document_type, d]));

  return (
    <div className="space-y-7">
      <StepHeading index={4} title="Documents" />

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        {slots.map((slot) => (
          <UploadSlot
            key={slot.key}
            applicationId={application.id}
            slot={slot}
            existing={byKey.get(slot.key)}
            vaultOptions={vaultOptions}
          />
        ))}
      </div>

      <ErrorAlert state={state} />

      <form action={formAction} className={STEP_FOOTER}>
        <input type="hidden" name="applicationId" value={application.id} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=3`} />
        <SubmitButton size="lg" pendingText="Checking…" className="gap-2">
          Continue <ArrowRight className="size-4" aria-hidden />
        </SubmitButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 5 — review + submit                                                   */
/* ------------------------------------------------------------------------- */

function ReviewSection({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 py-1.5 pr-2 pl-4 sm:pl-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${title.toLowerCase()}`}
          title="Edit"
          render={<Link href={editHref} />}
        >
          <Pencil aria-hidden />
        </Button>
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

function ReviewGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className={cn("text-sm break-words tabular-nums", value ? "font-semibold text-foreground" : "text-muted-foreground")}>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StepReview({
  application,
  desk = false,
}: {
  application: WizardApplication;
  /** Agent-desk host — see advanceWizard() in actions.ts. */
  desk?: boolean;
}) {
  const [state, formAction] = useActionState(submitVisaApplication, null);
  useDeskNavigate(state);
  const t = (application.traveler_details ?? {}) as Record<string, string>;
  const c = (application.contact_details ?? {}) as Record<string, string>;
  const travel = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const slots = parseDocumentSlots(application.resolved_documents ?? application.visa_type?.required_documents);
  const byKey = new Map(application.documents.map((d) => [d.document_type, d]));
  const questions = parseApplicationQuestions(application.visa_type?.application_questions);
  const answers = (application.custom_answers ?? {}) as Record<string, string>;
  const termsAndConditions = application.visa_type?.terms_and_conditions;
  const editBase = `${wizardBasePath(desk)}/${application.id}?step=`;

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const date = (v: unknown) => {
    const value = str(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? format(parseISO(value), "d MMM yyyy") : value;
  };

  // Same arithmetic as submit_visa_application(): unit price and fee per traveller.
  const travellers = application.applicant_type === "single" ? 1 : Math.max(application.members.length, 1);
  const unitPrice = Number(application.resolved_price ?? application.price ?? application.visa_type?.price ?? 0);
  const unitFee = Number(application.resolved_processing_fee ?? application.visa_type?.processing_fee ?? 0);
  const total = (unitPrice + unitFee) * travellers;
  const currency = application.visa_type?.currency ?? application.currency;

  return (
    <div className="space-y-6">
      <StepHeading index={5} title="Review your application" />

      <ReviewSection title="Personal information" editHref={`${editBase}2`}>
        <ReviewGrid
          rows={[
            ["Full name", t.full_name],
            ["Date of birth", date(t.date_of_birth)],
            ["Gender", GENDER_LABELS[t.gender] ?? t.gender],
            ["Nationality", t.nationality ? countryName(t.nationality) : ""],
            ["Passport number", t.passport_number],
            ["Passport expiry date", date(t.passport_expiry)],
            ["Email", c.email],
            ["Mobile", c.mobile],
          ]}
        />
      </ReviewSection>

      {application.applicant_type !== "single" ? (
        <ReviewSection title={`Members (${application.members.length})`} editHref={`${editBase}1`}>
          <div className="space-y-2">
            {application.members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{member.full_name}</span>
                <Badge variant="neutral">
                  {member.is_primary
                    ? "Primary applicant"
                    : (RELATIONSHIP_LABELS[member.relationship] ?? member.relationship)}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {member.passport_number}
                </span>
              </div>
            ))}
          </div>
        </ReviewSection>
      ) : null}

      <ReviewSection title="Travel information" editHref={`${editBase}3`}>
        <ReviewGrid
          rows={[
            ["Date of arrival", date(travel.arrival_date)],
            ["Date of departure", date(travel.departure_date)],
            ["Purpose of visit", PURPOSE_LABELS[str(travel.purpose)] ?? str(travel.purpose)],
            ["Address / hotel", str(travel.address)],
          ]}
        />
      </ReviewSection>

      {questions.length > 0 ? (
        <ReviewSection title="Additional questions" editHref={`${editBase}3`}>
          <ReviewGrid rows={questions.map((q) => [q.label, answers[q.key] ?? ""])} />
        </ReviewSection>
      ) : null}

      <ReviewSection title="Documents" editHref={`${editBase}4`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const doc = byKey.get(slot.key);
            return (
              <p key={slot.key} className="flex items-center gap-2 text-sm">
                {doc ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Provided" />
                ) : (
                  <X className="size-4 shrink-0 text-muted-foreground" aria-label="Not provided" />
                )}
                <span className="font-medium">{slot.label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {doc?.file_name ?? (slot.required ? "Missing" : "Not provided")}
                </span>
              </p>
            );
          })}
        </div>
      </ReviewSection>

      <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-secondary/40 px-4 py-4 sm:px-5">
        <div>
          <p className="text-sm font-semibold">Total</p>
          {travellers > 1 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {travellers} travellers × {fmtMoney(unitPrice + unitFee, currency)}
            </p>
          ) : null}
        </div>
        <p className="font-heading text-2xl font-bold text-primary tabular-nums">{fmtMoney(total, currency)}</p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="applicationId" value={application.id} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        {termsAndConditions ? (
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">Terms and conditions</p>
            <div className="max-h-40 overflow-y-auto rounded-md bg-secondary/40 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {termsAndConditions}
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="agreeTerms" className="mt-0.5 size-4 accent-primary" required />
              <span>I agree to the terms and conditions.</span>
            </label>
          </div>
        ) : null}
        <label className="flex items-start gap-2.5 rounded-lg border border-border p-4 text-sm">
          <input type="checkbox" name="confirmAccuracy" className="mt-0.5 size-4 accent-primary" required />
          <span>
            I confirm that all the information provided is correct and matches the travel
            documents. I understand that once submitted, changes may not be possible.
          </span>
        </label>

        <ErrorAlert state={state} />

        <div className={STEP_FOOTER}>
          <BackButton href={`${editBase}4`} />
          <SubmitButton size="lg" pendingText="Submitting…" className="gap-2">
            Continue to payment <ArrowRight className="size-4" aria-hidden />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
