"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  Pencil,
  Plane,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  User,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { createUploadQueue } from "@/modules/visa/upload-queue";
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
  type MemberActionState,
} from "@/modules/visa/actions";
import {
  RELATIONSHIPS,
  formatRequirementAnswer,
  memberRequirementAnswers,
  parseDocumentSlots,
  parseRequirementAnswers,
  parseRequirementSections,
  sectionFileSlots,
  sectionInputName,
  todayIso,
  type DocumentSlot,
  type RequirementField,
  type RequirementSection,
  type SectionAnswers,
} from "@/modules/visa/schemas";
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

/** Navigate after a saved public or agent step on the current origin. */
function useWizardNavigate(state: ActionState) {
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
  return <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>;
}

/** Back on the left, primary on the right; stacked full-width on phones (primary first). */
const STEP_FOOTER =
  "flex flex-col-reverse gap-3 border-t border-border pt-6 [&>*]:w-full [&_[data-slot=button]]:min-h-12 [&_[data-slot=button]]:px-5 [&_[data-slot=button]]:text-base @min-[30rem]/visa-form:flex-row @min-[30rem]/visa-form:items-center @min-[30rem]/visa-form:justify-between @min-[30rem]/visa-form:[&>*]:w-auto";

function ErrorAlert({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

function BackButton({ href, disabled }: { href: string; disabled?: boolean }) {
  return (
    <Button variant="outline" size="lg" disabled={disabled} render={<Link href={href} />} className="gap-2">
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
    <div className={cn("min-w-0 space-y-2 [&_input]:min-h-12 [&_input]:rounded-lg [&_input]:px-3.5 [&_input]:text-base [&_textarea]:min-h-24 [&_textarea]:px-3.5 [&_textarea]:text-base [&_[data-slot=select-trigger]]:min-h-12 [&_[data-slot=select-trigger]]:px-3.5 [&_[data-slot=select-trigger]]:text-base [&_[data-slot=combobox-trigger]]:min-h-12", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
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
  required = false,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  id?: string;
  required?: boolean;
}) {
  return (
    <Select name={name} defaultValue={defaultValue || undefined} items={options} required={required}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="min-h-11 py-2.5">
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
  },
  {
    value: "family",
    icon: Users,
    title: "Family",
  },
  {
    value: "group",
    icon: UsersRound,
    title: "Group",
  },
] as const;

type WizardMember = WizardApplication["members"][number];

function MemberDialog({
  applicationId,
  member,
  trigger,
  onSaved,
}: {
  applicationId: string;
  member?: WizardMember;
  trigger: React.ReactNode;
  onSaved: (member: WizardMember) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveVisaMember, null);
  const lastState = useRef<MemberActionState>(null);

  useEffect(() => {
    if (state !== lastState.current && state && state.error === null) {
      onSaved(state.member);
      setOpen(false);
    }
    lastState.current = state;
  }, [state, onSaved]);

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
              required
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
              required
              defaultValue={member?.nationality ?? undefined}
              placeholder="Search nationality"
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
            <ErrorAlert state={state?.error ? { error: state.error } : null} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…" className="min-h-12 px-5 text-base">{member ? "Save changes" : "Add member"}</SubmitButton>
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
  useWizardNavigate(state);
  const [applicantType, setApplicantType] = useState(application.applicant_type);
  // Saved members merge in locally (see saveVisaMember); a fresh server
  // render (after a removal) replaces the list.
  const [members, setMembers] = useState(application.members);
  const [serverMembers, setServerMembers] = useState(application.members);
  if (serverMembers !== application.members) {
    setServerMembers(application.members);
    setMembers(application.members);
  }
  const upsertMember = useCallback((saved: WizardMember) => {
    setMembers((current) =>
      current.some((m) => m.id === saved.id)
        ? current.map((m) => (m.id === saved.id ? saved : m))
        : [...current, saved]
    );
  }, []);

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
                  "relative flex items-center gap-4 rounded-xl border bg-card p-5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-40 sm:flex-col sm:items-start sm:gap-5 sm:p-5",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                  )}
                  aria-hidden
                >
                  <card.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 sm:flex-none">
                  <span className="block text-sm font-bold">{card.title}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2 sm:absolute sm:top-5 sm:right-5",
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
              onSaved={upsertMember}
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
                            onSaved={upsertMember}
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
          <SubmitButton size="lg" pendingText="Saving…" className="min-w-36 gap-2 rounded-xl">
            Continue to personal details <ArrowRight className="size-4" aria-hidden />
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
  useWizardNavigate(state);
  const t = (application.traveler_details ?? {}) as Record<string, string>;
  const c = (application.contact_details ?? {}) as Record<string, string>;
  // After a validation error, prefer what the user just typed over saved data.
  const v = state?.values ?? {};

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="applicationId" value={application.id} />
      {desk ? <input type="hidden" name="desk" value="1" /> : null}
      <StepHeading index={2} title="Personal information" />

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 @min-[30rem]/visa-form:grid-cols-2">
        <Field label="Full name (as in passport)" htmlFor="fullName" required className="@min-[30rem]/visa-form:col-span-2">
          <Input id="fullName" name="fullName" minLength={2} pattern=".*\S.*" autoComplete="name" defaultValue={v.fullName ?? t.full_name ?? ""} placeholder="Enter full name" required />
        </Field>
        <Field label="Date of birth" htmlFor="dateOfBirth" required>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" autoComplete="bday" max={todayIso()} defaultValue={v.dateOfBirth ?? t.date_of_birth ?? ""} required />
        </Field>
        <Field label="Gender" htmlFor="gender" required>
          <LabeledSelect
            id="gender"
            name="gender"
            required
            defaultValue={v.gender ?? t.gender}
            placeholder="Select gender"
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </Field>
        <Field label="Nationality" htmlFor="nationality" required>
          <CountrySearchSelect id="nationality" name="nationality" defaultValue={v.nationality ?? t.nationality ?? undefined} placeholder="Search nationality" required />
        </Field>
        <Field label="Passport number" htmlFor="passportNumber" required>
          <Input id="passportNumber" name="passportNumber" minLength={3} pattern=".*\S.*" autoCapitalize="characters" spellCheck={false} defaultValue={v.passportNumber ?? t.passport_number ?? ""} placeholder="Enter passport number" required />
        </Field>
        <Field label="Passport expiry date" htmlFor="passportExpiry" required>
          <Input id="passportExpiry" name="passportExpiry" type="date" min={todayIso()} defaultValue={v.passportExpiry ?? t.passport_expiry ?? ""} required />
        </Field>
        <Field label="Email address" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email ?? c.email ?? ""} placeholder="Enter email address" required />
        </Field>
        <Field label="Mobile number" htmlFor="mobile" required className="@min-[30rem]/visa-form:col-span-2">
          <PhoneInput
            id="mobile"
            name="mobile"
            defaultValue={v.mobile ?? c.mobile ?? ""}
            defaultCountry={v.nationality ?? t.nationality ?? "SO"}
            placeholder="61 XXXXXXX"
            validateNumber
            required
          />
        </Field>
      </div>

      <ErrorAlert state={state} />

      <div className={STEP_FOOTER}>
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=1`} />
        <SubmitButton size="lg" pendingText="Saving…" className="min-w-36 gap-2 rounded-xl">
          Continue to travel details <ArrowRight className="size-4" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 3 — travel information                                                */
/* ------------------------------------------------------------------------- */

function YesNo({ name, label, defaultValue, required }: { name: string; label: string; defaultValue?: "yes" | "no"; required?: boolean }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}{required ? <span className="text-destructive"> *</span> : null}</legend>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((option) => (
          <label key={option} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-base transition-colors has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <input type="radio" name={name} value={option} defaultChecked={defaultValue === option} required={required} className="size-4 accent-primary" />
            {option === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RequiredChoices({ field, name, initial }: { field: RequirementField; name: string; initial: string[] }) {
  const [selected, setSelected] = useState(initial);
  return (
    <fieldset className="min-w-0 space-y-2 @min-[30rem]/visa-form:col-span-2">
      <legend className="text-sm font-medium">{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</legend>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option, index) => (
          <label key={option} className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-border px-4 text-base transition-colors has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <input type="checkbox" name={name} value={option} checked={selected.includes(option)} required={field.required && selected.length === 0 && index === 0}
              onChange={(event) => setSelected((values) => event.target.checked ? [...values, option] : values.filter((value) => value !== option))}
              className="size-4 accent-primary" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const FULL_WIDTH_FIELD_TYPES: readonly RequirementField["type"][] = ["long_text", "multi_choice"];

/** One admin-defined field. Value precedence: re-filled form values, then saved answers. */
function RequirementInput({
  field,
  name,
  saved,
  refill,
}: {
  field: RequirementField;
  name: string;
  saved: string | string[] | undefined;
  refill: string | undefined;
}) {
  const id = name.replace(/[^a-zA-Z0-9_-]/g, "-");
  const text = refill ?? (typeof saved === "string" ? saved : "");
  const wide = FULL_WIDTH_FIELD_TYPES.includes(field.type) ? "@min-[30rem]/visa-form:col-span-2" : undefined;

  switch (field.type) {
    case "yes_no":
      return <YesNo name={name} label={field.label} defaultValue={text === "yes" || text === "no" ? text : undefined} required={field.required} />;
    case "dropdown":
      return (
        <Field label={field.label} htmlFor={id} required={field.required}>
          <LabeledSelect
            id={id}
            name={name}
            required={field.required}
            defaultValue={text}
            placeholder="Select an option"
            options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          />
        </Field>
      );
    case "multi_choice": {
      let selected: string[] = Array.isArray(saved) ? saved : [];
      if (refill !== undefined) {
        try {
          const parsed: unknown = JSON.parse(refill);
          selected = Array.isArray(parsed) ? parsed.map(String) : [refill];
        } catch {
          selected = [refill];
        }
      }
      return <RequiredChoices field={field} name={name} initial={selected} />;
    }
    case "country":
      return (
        <Field label={field.label} htmlFor={id} required={field.required}>
          <CountrySearchSelect id={id} name={name} required={field.required} defaultValue={text || undefined} placeholder="Search country" />
        </Field>
      );
    case "phone":
      return (
        <Field label={field.label} htmlFor={id} required={field.required}>
          <PhoneInput id={id} name={name} validateNumber required={field.required} defaultValue={text} />
        </Field>
      );
    case "long_text":
      return (
        <Field label={field.label} htmlFor={id} required={field.required} className={wide}>
          <Textarea id={id} name={name} rows={3} defaultValue={text} required={field.required} maxLength={2000} />
        </Field>
      );
    default: {
      const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text";
      return (
        <Field label={field.label} htmlFor={id} required={field.required}>
          <Input
            id={id}
            name={name}
            type={inputType}
            step={field.type === "number" ? "any" : undefined}
            defaultValue={text}
            required={field.required}
            maxLength={inputType === "text" ? 2000 : undefined}
          />
        </Field>
      );
    }
  }
}

/** An admin-defined section's non-file fields, for the application or one traveller. */
function RequirementSectionFields({
  section,
  title,
  memberId,
  answers,
  values,
}: {
  section: RequirementSection;
  title: string;
  memberId?: string;
  answers: SectionAnswers | undefined;
  values: Record<string, string>;
}) {
  return (
    <div className="space-y-5 border-t border-border pt-5">
      <h3 className="font-heading text-base font-bold">{title}</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 @min-[30rem]/visa-form:grid-cols-2">
        {section.fields
          .filter((field) => field.type !== "file")
          .map((field) => {
            const name = sectionInputName(section.key, field.key, memberId);
            return <RequirementInput key={field.key} field={field} name={name} saved={answers?.[field.key]} refill={values[name]} />;
          })}
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
  useWizardNavigate(state);
  const t = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const v = state?.values ?? {};
  const str = (key: string) => (typeof t[key] === "string" ? (t[key] as string) : "");
  const sections = parseRequirementSections(application.visa_type?.application_sections).filter((section) =>
    section.fields.some((f) => f.type !== "file")
  );
  const appAnswers = parseRequirementAnswers(application.custom_answers);

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="applicationId" value={application.id} />
      {desk ? <input type="hidden" name="desk" value="1" /> : null}
      <StepHeading index={3} title="Travel information" />

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 @min-[30rem]/visa-form:grid-cols-2">
        <Field label={`Arrival in ${destination}`} htmlFor="arrivalDate" required>
          <Input id="arrivalDate" name="arrivalDate" type="date" min={todayIso()} defaultValue={v.arrivalDate ?? str("arrival_date")} required />
        </Field>
        <Field label={`Departure from ${destination}`} htmlFor="departureDate" required>
          <Input id="departureDate" name="departureDate" type="date" min={todayIso()} defaultValue={v.departureDate ?? str("departure_date")} required />
        </Field>
        <Field label="Purpose of visit" htmlFor="purposeOfVisit" required className="@min-[30rem]/visa-form:col-span-2">
          <LabeledSelect
            id="purposeOfVisit"
            name="purposeOfVisit"
            required
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

      {sections.map((section) =>
        section.scope === "application" ? (
          <RequirementSectionFields
            key={section.key}
            section={section}
            title={section.title}
            answers={appAnswers[section.key]}
            values={v}
          />
        ) : (
          application.members.map((member) => (
            <RequirementSectionFields
              key={`${section.key}-${member.id}`}
              section={section}
              title={application.members.length > 1 ? `${section.title} — ${member.full_name}` : section.title}
              memberId={member.id}
              answers={memberRequirementAnswers(member.details)[section.key]}
              values={v}
            />
          ))
        )
      )}

      <ErrorAlert state={state} />

      <div className={STEP_FOOTER}>
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=2`} />
        <SubmitButton size="lg" pendingText="Saving…" className="min-w-36 gap-2 rounded-xl">
          Continue to documents <ArrowRight className="size-4" aria-hidden />
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
  memberId,
  existing,
  vaultOptions,
  enqueueUpload,
}: {
  applicationId: string;
  slot: DocumentSlot;
  /** Set for a traveller-scope section file field. */
  memberId?: string;
  existing?: WizardApplication["documents"][number];
  vaultOptions: VaultOption[];
  enqueueUpload: (data: FormData) => Promise<ActionState>;
}) {
  const domId = `${slot.key}-${memberId ?? "app"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const [state, setState] = useState<ActionState>(null);
  const [uploading, setUploading] = useState(false);
  const submitting = useRef(false);
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
    <div className="min-w-0 space-y-3 rounded-xl bg-secondary/25 p-4 ring-1 ring-border">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {slot.label}
        {slot.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </div>
      {slot.description ? (
        <details className="text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm py-1 font-medium underline decoration-border underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Document requirements</summary>
          <div className="pt-1 leading-relaxed">{slot.description}</div>
        </details>
      ) : null}

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
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          submitting.current = true;
          setUploading(true);
          setState(null);
          try {
            setState(await enqueueUpload(data));
          } catch {
            setState({ error: "Upload failed. Choose the file again to retry." });
          } finally {
            submitting.current = false;
            setUploading(false);
            // Restore the picker after failures as well as successful uploads.
            form.reset();
          }
        }}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="slotKey" value={slot.key} />
          {memberId ? <input type="hidden" name="memberId" value={memberId} /> : null}
          <FileField
            name="file"
            accept=".jpg,.jpeg,.png,.pdf"
            maxBytes={(slot.max_mb ?? 5) * 1024 * 1024}
            autoSubmit
            uploading={uploading}
            disabled={uploading}
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
          {memberId ? <input type="hidden" name="memberId" value={memberId} /> : null}
          <label className="sr-only" htmlFor={`vault-${domId}`}>
            Use a saved document for {slot.label}
          </label>
          <select
            id={`vault-${domId}`}
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
  const router = useRouter();
  const uploadQueue = useRef(createUploadQueue());
  const [pendingUploads, setPendingUploads] = useState(0);
  const pendingUploadsRef = useRef(0);
  const enqueueUpload = useCallback(async (data: FormData) => {
    pendingUploadsRef.current += 1;
    setPendingUploads(pendingUploadsRef.current);
    try {
      const result = await uploadQueue.current(() => new Promise<ActionState>((resolve, reject) => {
        startTransition(() => {
          void uploadVisaDocument(null, data).then(resolve, reject);
        });
      }));
      if (result && !result.error) router.refresh();
      return result;
    } finally {
      pendingUploadsRef.current -= 1;
      setPendingUploads(pendingUploadsRef.current);
    }
  }, [router]);
  useWizardNavigate(state);
  const slots = parseDocumentSlots(application.resolved_documents ?? application.visa_type?.required_documents);
  const byKey = new Map(application.documents.map((d) => [d.document_type, d]));
  const fileSlots = sectionFileSlots(parseRequirementSections(application.visa_type?.application_sections), application.members);
  const fileGroups = [...new Set(fileSlots.map((f) => f.sectionTitle))];

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
            enqueueUpload={enqueueUpload}
          />
        ))}
      </div>

      {fileGroups.map((group) => (
        <div key={group} className="space-y-5 border-t border-border pt-5">
          <h3 className="font-heading text-base font-bold">{group}</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
            {fileSlots
              .filter((f) => f.sectionTitle === group)
              .map((f) => (
                <UploadSlot
                  key={`${f.documentType}-${f.memberId ?? "app"}`}
                  applicationId={application.id}
                  slot={{
                    key: f.documentType,
                    label: f.memberName && application.members.length > 1 ? `${f.label} — ${f.memberName}` : f.label,
                    required: f.required,
                  }}
                  memberId={f.memberId ?? undefined}
                  existing={application.documents.find(
                    (d) => d.document_type === f.documentType && (f.memberId === null || d.member_id === f.memberId)
                  )}
                  vaultOptions={vaultOptions}
                  enqueueUpload={enqueueUpload}
                />
              ))}
          </div>
        </div>
      ))}

      <ErrorAlert state={state} />

      <form action={formAction} className={STEP_FOOTER} onSubmit={(event) => {
        if (pendingUploadsRef.current > 0) event.preventDefault();
      }}>
        <input type="hidden" name="applicationId" value={application.id} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=3`} disabled={pendingUploads > 0} />
        <SubmitButton size="lg" pendingText="Checking…" disabled={pendingUploads > 0} className="min-w-36 gap-2 rounded-xl">
          Review application <ArrowRight className="size-4" aria-hidden />
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
  icon: Icon,
  meta,
  editHref,
  children,
}: {
  title: string;
  icon: LucideIcon;
  meta?: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 @min-[30rem]/visa-form:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
          {meta ? <span className="ml-2 font-normal text-muted-foreground tabular-nums">{meta}</span> : null}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label={`Edit ${title.toLowerCase()}`}
          render={<Link href={editHref} />}
        >
          <Pencil className="size-3.5" aria-hidden /> Edit
        </Button>
      </div>
      <div className="px-4 py-5 @min-[30rem]/visa-form:px-5">{children}</div>
    </section>
  );
}

function ReviewGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 @min-[30rem]/visa-form:grid-cols-2 @min-[48rem]/visa-form:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd
            className={cn(
              "text-sm [overflow-wrap:anywhere] tabular-nums",
              value ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function ReviewDocumentRow({ label, fileName, required }: { label: string; fileName: string | null; required: boolean }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          fileName ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <FileText className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{fileName ?? "No file uploaded"}</p>
      </div>
      {fileName ? (
        <Badge variant="success">
          <CheckCircle2 aria-hidden /> Uploaded
        </Badge>
      ) : required ? (
        <Badge variant="destructive">Missing</Badge>
      ) : (
        <Badge variant="neutral">Optional</Badge>
      )}
    </li>
  );
}

export function StepReview({
  application,
  desk = false,
  credit = null,
}: {
  application: WizardApplication;
  /** Agent-desk host — see advanceWizard() in actions.ts. */
  desk?: boolean;
  /** Re-application credit from a refused visa; offsets the STS fee. */
  credit?: { amount: number; currency: string } | null;
}) {
  const [state, formAction] = useActionState(submitVisaApplication, null);
  useWizardNavigate(state);
  const t = (application.traveler_details ?? {}) as Record<string, string>;
  const c = (application.contact_details ?? {}) as Record<string, string>;
  const travel = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const slots = parseDocumentSlots(application.resolved_documents ?? application.visa_type?.required_documents);
  const byKey = new Map(application.documents.map((d) => [d.document_type, d]));
  const sections = parseRequirementSections(application.visa_type?.application_sections);
  const appAnswers = parseRequirementAnswers(application.custom_answers);
  const fileSlots = sectionFileSlots(sections, application.members);
  const answerRows = (section: RequirementSection, answers: SectionAnswers | undefined): Array<[string, string]> =>
    section.fields
      .filter((f) => f.type !== "file")
      .map((f) => [f.label, formatRequirementAnswer(f, answers?.[f.key])]);
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
  const creditApplied = credit ? Math.min(credit.amount, unitFee * travellers) : 0;
  const total = (unitPrice + unitFee) * travellers - creditApplied;
  const currency = application.visa_type?.currency ?? application.currency;
  const perTraveller = travellers > 1 ? ` × ${travellers}` : "";

  const documentRows = [
    ...slots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      fileName: byKey.get(slot.key)?.file_name ?? null,
      required: slot.required,
    })),
    ...fileSlots.map((f) => ({
      key: `${f.documentType}-${f.memberId ?? "app"}`,
      label: f.memberName && application.members.length > 1 ? `${f.label} — ${f.memberName}` : f.label,
      fileName:
        application.documents.find(
          (d) => d.document_type === f.documentType && (f.memberId === null || d.member_id === f.memberId)
        )?.file_name ?? null,
      required: f.required,
    })),
  ];
  const uploaded = documentRows.filter((d) => d.fileName).length;

  return (
    <div className="space-y-5">
      <StepHeading index={5} title="Review your application" />

      <ReviewSection title="Personal information" icon={User} editHref={`${editBase}2`}>
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
        <ReviewSection
          title="Travellers"
          icon={Users}
          meta={String(application.members.length)}
          editHref={`${editBase}1`}
        >
          <ul className="divide-y divide-border">
            {application.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                  {initials(member.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.is_primary
                      ? "Primary applicant"
                      : (RELATIONSHIP_LABELS[member.relationship] ?? member.relationship)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Passport</p>
                  <p className="font-mono text-sm tracking-wide">{member.passport_number}</p>
                </div>
              </li>
            ))}
          </ul>
        </ReviewSection>
      ) : null}

      <ReviewSection title="Travel information" icon={Plane} editHref={`${editBase}3`}>
        <ReviewGrid
          rows={[
            ["Date of arrival", date(travel.arrival_date)],
            ["Date of departure", date(travel.departure_date)],
            ["Purpose of visit", PURPOSE_LABELS[str(travel.purpose)] ?? str(travel.purpose)],
            ["Address / hotel", str(travel.address)],
          ]}
        />
      </ReviewSection>

      {sections
        .filter((section) => section.fields.some((f) => f.type !== "file"))
        .map((section) => (
          <ReviewSection key={section.key} title={section.title} icon={ClipboardList} editHref={`${editBase}3`}>
            {section.scope === "application" ? (
              <ReviewGrid rows={answerRows(section, appAnswers[section.key])} />
            ) : (
              <div className="divide-y divide-border">
                {application.members.map((member) => (
                  <div key={member.id} className="space-y-4 py-5 first:pt-0 last:pb-0">
                    {application.members.length > 1 ? (
                      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <User className="size-3.5" aria-hidden /> {member.full_name}
                      </p>
                    ) : null}
                    <ReviewGrid rows={answerRows(section, memberRequirementAnswers(member.details)[section.key])} />
                  </div>
                ))}
              </div>
            )}
          </ReviewSection>
        ))}

      <ReviewSection
        title="Documents"
        icon={FileCheck2}
        meta={`${uploaded} / ${documentRows.length}`}
        editHref={`${editBase}4`}
      >
        <ul className="divide-y divide-border">
          {documentRows.map((d) => (
            <ReviewDocumentRow key={d.key} label={d.label} fileName={d.fileName} required={d.required} />
          ))}
        </ul>
      </ReviewSection>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 @min-[30rem]/visa-form:px-5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="size-4" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold">Price summary</h3>
        </div>
        <dl className="space-y-2.5 px-4 py-5 text-sm tabular-nums @min-[30rem]/visa-form:px-5">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Visa fee{perTraveller}</dt>
            <dd>{fmtMoney(unitPrice * travellers, currency)}</dd>
          </div>
          {unitFee > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Processing fee{perTraveller}</dt>
              <dd>{fmtMoney(unitFee * travellers, currency)}</dd>
            </div>
          ) : null}
          {creditApplied > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Re-application credit</dt>
              <dd className="text-primary">−{fmtMoney(creditApplied, currency)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex items-baseline justify-between gap-4 border-t border-border bg-primary/5 px-4 py-4 @min-[30rem]/visa-form:px-5">
          <span className="text-sm font-semibold">Total due</span>
          <span className="font-heading text-2xl font-bold text-primary tabular-nums">{fmtMoney(total, currency)}</span>
        </div>
      </section>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="applicationId" value={application.id} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 @min-[30rem]/visa-form:px-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold">Declarations</h3>
          </div>
          <div className="divide-y divide-border">
            {termsAndConditions ? (
              <div className="space-y-3 px-4 py-4 @min-[30rem]/visa-form:px-5">
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {termsAndConditions}
                </div>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" name="agreeTerms" className="mt-0.5 size-4 shrink-0 accent-primary" required />
                  <span>I agree to the terms and conditions.</span>
                </label>
              </div>
            ) : null}
            <label className="flex cursor-pointer items-start gap-3 px-4 py-4 text-sm transition-colors hover:bg-muted/20 @min-[30rem]/visa-form:px-5">
              <input type="checkbox" name="confirmAccuracy" className="mt-0.5 size-4 shrink-0 accent-primary" required />
              <span className="leading-relaxed">
                I confirm that all the information provided is correct and matches the travel
                documents. I understand that once submitted, changes may not be possible.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-4 text-sm transition-colors hover:bg-muted/20 @min-[30rem]/visa-form:px-5">
              <input type="checkbox" name="authorise" className="mt-0.5 size-4 shrink-0 accent-primary" required />
              <span className="space-y-1.5 leading-relaxed">
                <span className="block">
                  {desk
                    ? "The applicant authorises Scout Travel Solution to prepare and file this visa application with the issuing authority on their behalf."
                    : "I authorise Scout Travel Solution to prepare and file this visa application with the issuing authority on my behalf."}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Refunds: in full until STS files the application; none once filed. If the visa is refused,
                  the STS service fee is credited towards a new application.
                </span>
              </span>
            </label>
          </div>
        </section>

        <ErrorAlert state={state} />

        <div className={STEP_FOOTER}>
          <BackButton href={`${editBase}4`} />
          <SubmitButton size="lg" pendingText="Submitting…" className="min-w-36 gap-2 rounded-xl">
            Continue to payment <ArrowRight className="size-4" aria-hidden />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
