"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  FileText,
  Info,
  MapPin,
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
import { RELATIONSHIPS, parseDocumentSlots, parseApplicationQuestions, type DocumentSlot } from "@/modules/visa/schemas";
import type { WizardApplication } from "@/modules/visa/queries";

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

function StepHeading({ index, title }: { index?: number; title: string }) {
  return (
    <div>
      {index ? (
        <p className="text-xs font-bold tracking-widest text-primary uppercase">Step {index} of 5</p>
      ) : null}
      <h2 className="mt-1 font-heading text-xl font-bold sm:text-2xl">{title}</h2>
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

function BackButton({ href }: { href: string }) {
  return (
    <Button variant="outline" render={<Link href={href} />} className="gap-2">
      <ArrowLeft className="size-4" /> Back
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
}: {
  name: string;
  defaultValue?: string | null;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select name={name} defaultValue={defaultValue || undefined} items={options}>
      <SelectTrigger className="w-full">
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
  other: "Other Relative",
};

const RELATIONSHIP_BADGE_STYLES: Record<string, string> = {
  self: "bg-chart-3/10 text-chart-3",
  spouse: "bg-chart-4/10 text-chart-4",
  son: "bg-primary/10 text-primary",
  daughter: "bg-primary/10 text-primary",
  grandfather: "bg-brand-gold/15 text-brand-gold",
  grandmother: "bg-brand-gold/15 text-brand-gold",
};

/* ------------------------------------------------------------------------- */
/* Step 1 — applicant type + members                                          */
/* ------------------------------------------------------------------------- */

const APPLICANT_TYPE_CARDS = [
  {
    value: "single",
    icon: User,
    title: "Single Applicant",
    description: "I am applying only for myself",
  },
  {
    value: "family",
    icon: Users,
    title: "Family Application",
    description: "I am applying with my family members",
  },
  {
    value: "group",
    icon: UsersRound,
    title: "Group Application",
    description: "I am applying with a group (not family)",
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
          <DialogTitle>{member ? "Edit Member" : "Add Member"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          {member ? <input type="hidden" name="memberId" value={member.id} /> : null}
          <Field label="Full Name (as in passport)" htmlFor={`member-name-${member?.id ?? "new"}`} required className="sm:col-span-2">
            <Input
              id={`member-name-${member?.id ?? "new"}`}
              name="fullName"
              defaultValue={member?.full_name ?? ""}
              placeholder="Enter full name"
              required
            />
          </Field>
          <Field label="Relationship" required>
            <LabeledSelect
              name="relationship"
              defaultValue={member?.relationship}
              placeholder="Select relationship"
              options={RELATIONSHIPS.filter((r) => r !== "self").map((rel) => ({
                value: rel,
                label: RELATIONSHIP_LABELS[rel],
              }))}
            />
          </Field>
          <Field label="Date of Birth" htmlFor={`member-dob-${member?.id ?? "new"}`} required>
            <Input
              id={`member-dob-${member?.id ?? "new"}`}
              name="dateOfBirth"
              type="date"
              defaultValue={member?.date_of_birth ?? ""}
              required
            />
          </Field>
          <Field label="Nationality" required>
            <CountrySearchSelect
              name="nationality"
              defaultValue={member?.nationality ?? "SO"}
              placeholder="Select nationality"
            />
          </Field>
          <Field label="Passport Number" htmlFor={`member-passport-${member?.id ?? "new"}`} required>
            <Input
              id={`member-passport-${member?.id ?? "new"}`}
              name="passportNumber"
              defaultValue={member?.passport_number ?? ""}
              placeholder="Enter passport number"
              required
            />
          </Field>
          <Field label="Passport Expiry Date" htmlFor={`member-expiry-${member?.id ?? "new"}`}>
            <Input
              id={`member-expiry-${member?.id ?? "new"}`}
              name="passportExpiry"
              type="date"
              defaultValue={member?.passport_expiry ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <ErrorAlert state={state} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{member ? "Save Changes" : "Add Member"}</SubmitButton>
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
  const others = members.filter((m) => !m.is_primary);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <StepHeading index={1} title="Applicant type" />
        <div className="grid gap-4 sm:grid-cols-3">
          {APPLICANT_TYPE_CARDS.map((card) => {
            const active = applicantType === card.value;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => setApplicantType(card.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center transition-all",
                  active
                    ? "border-primary shadow-sm ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-full",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <card.icon className="size-5" />
                </span>
                <span className="text-sm font-bold">{card.title}</span>
                <span className="text-xs text-muted-foreground">{card.description}</span>
                <span
                  className={cn(
                    "mt-1 flex size-4 items-center justify-center rounded-full border-2",
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
          <StepHeading title={applicantType === "family" ? "Family details" : "Group details"} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-chart-3/10 px-4 py-3">
            <p className="flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-chart-3" />
              <span>
                {applicantType === "family"
                  ? "Spouse, children, parents and other dependents."
                  : "Each member needs their own passport details."}
              </span>
            </p>
            <MemberDialog
              applicationId={application.id}
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> Add Member
                </Button>
              }
            />
          </div>

          {members.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Passport No.</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member, i) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                            <User className="size-3.5 text-muted-foreground" />
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{member.full_name}</span>
                            <Badge
                              className={cn(
                                "mt-0.5 border-transparent text-[10px]",
                                member.is_primary
                                  ? "bg-chart-3/10 text-chart-3"
                                  : (RELATIONSHIP_BADGE_STYLES[member.relationship] ??
                                      "bg-muted text-muted-foreground")
                              )}
                            >
                              {member.is_primary
                                ? "Primary Applicant"
                                : (RELATIONSHIP_LABELS[member.relationship] ?? member.relationship)}
                            </Badge>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="capitalize">
                        {RELATIONSHIP_LABELS[member.relationship] ?? member.relationship}
                      </TableCell>
                      <TableCell>{member.date_of_birth ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {member.passport_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center justify-end gap-1">
                          <MemberDialog
                            applicationId={application.id}
                            member={member}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Edit member">
                                <Pencil className="size-3.5 text-primary" />
                              </Button>
                            }
                          />
                          {!member.is_primary ? (
                            <form action={removeVisaMember}>
                              <input type="hidden" name="memberId" value={member.id} />
                              <input type="hidden" name="applicationId" value={application.id} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove member"
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
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
              No members yet — your details are added automatically in the next step, and you can
              add {applicantType === "family" ? "family members" : "group members"} with the button
              above.
            </p>
          )}
        </section>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="applicantType" value={applicantType} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        <ErrorAlert state={state} />
        <div className="flex items-center justify-between">
          <BackButton href={backHref} />
          <SubmitButton pendingText="Saving…" className="gap-2">
            Continue <ArrowRight className="size-4" />
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
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth ?? t.date_of_birth ?? ""} required />
        </Field>
        <Field label="Gender" required>
          <LabeledSelect
            name="gender"
            defaultValue={v.gender ?? t.gender}
            placeholder="Select gender"
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </Field>
        <Field label="Nationality" required>
          <CountrySearchSelect name="nationality" defaultValue={v.nationality ?? t.nationality ?? "SO"} placeholder="Select nationality" />
        </Field>
        <Field label="Passport number" htmlFor="passportNumber" required>
          <Input id="passportNumber" name="passportNumber" defaultValue={v.passportNumber ?? t.passport_number ?? ""} placeholder="Enter passport number" required />
        </Field>
        <Field label="Passport expiry date" htmlFor="passportExpiry" required>
          <Input id="passportExpiry" name="passportExpiry" type="date" defaultValue={v.passportExpiry ?? t.passport_expiry ?? ""} required />
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

      <div className="flex items-center justify-between">
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=1`} />
        <SubmitButton pendingText="Saving…" className="gap-2">
          Continue <ArrowRight className="size-4" />
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
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-4">
        {(["yes", "no"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setValue(option)}
            className="flex items-center gap-2 text-sm"
          >
            <span
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
          <Input id="arrivalDate" name="arrivalDate" type="date" defaultValue={v.arrivalDate ?? str("arrival_date")} required />
        </Field>
        <Field label={`Departure from ${destination}`} htmlFor="departureDate" required>
          <Input id="departureDate" name="departureDate" type="date" defaultValue={v.departureDate ?? str("departure_date")} required />
        </Field>
        <Field label="Purpose of visit" required className="sm:col-span-2">
          <LabeledSelect
            name="purposeOfVisit"
            defaultValue={v.purposeOfVisit ?? str("purpose")}
            placeholder="Select purpose of visit"
            options={[
              { value: "tourism", label: "Tourism" },
              { value: "business", label: "Business" },
              { value: "family_visit", label: "Family visit" },
              { value: "medical", label: "Medical" },
              { value: "transit", label: "Transit" },
              { value: "umrah", label: "Umrah" },
              { value: "other", label: "Other" },
            ]}
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
          <p className="text-sm font-semibold">Additional questions for {destination}</p>
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
                  <Field key={q.key} label={q.label} required={q.required}>
                    <LabeledSelect
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

      <div className="flex items-center justify-between">
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=2`} />
        <SubmitButton pendingText="Saving…" className="gap-2">
          Continue <ArrowRight className="size-4" />
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
  const [state, formAction, pending] = useActionState(uploadVisaDocument, null);
  const [attachState, attachAction, attaching] = useActionState(attachVaultDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        {slot.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (Optional)</span>}
      </p>
      {slot.description ? <p className="text-xs text-muted-foreground">{slot.description}</p> : null}

      {existing ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <FileText className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{existing.file_name ?? slot.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(existing.file_size)} · Uploaded
            </p>
          </div>
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          <form action={removeVisaDocument}>
            <input type="hidden" name="documentId" value={existing.id} />
            <input type="hidden" name="applicationId" value={applicationId} />
            <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remove ${slot.label}`}>
              <X className="size-3.5" />
            </Button>
          </form>
        </div>
      ) : (
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="slotKey" value={slot.key} />
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="sr-only"
            onChange={() => formRef.current?.requestSubmit()}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
              pending
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-secondary/40"
            )}
          >
            <CloudUpload className={cn("size-6", pending ? "animate-pulse text-primary" : "text-muted-foreground")} />
            <span className="text-sm font-medium">
              {pending ? "Uploading…" : (
                <>
                  Drag &amp; drop or <span className="text-primary">browse</span>
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              JPG, PNG, PDF (Max. {slot.max_mb ?? 5}MB)
            </span>
          </button>
          {state?.error ? <p className="mt-1.5 text-xs text-destructive">{state.error}</p> : null}
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
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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
          <Button type="submit" size="sm" variant="outline" disabled={attaching}>
            {attaching ? "Attaching…" : "Attach"}
          </Button>
          {attachState?.error ? (
            <p className="w-full text-xs text-destructive">{attachState.error}</p>
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

      <form action={formAction} className="flex items-center justify-between">
        <input type="hidden" name="applicationId" value={application.id} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        <BackButton href={`${wizardBasePath(desk)}/${application.id}?step=3`} />
        <SubmitButton pendingText="Checking…" className="gap-2">
          Continue <ArrowRight className="size-4" />
        </SubmitButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 5 — review + submit                                                   */
/* ------------------------------------------------------------------------- */

function ReviewSection({
  icon: Icon,
  title,
  editHref,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-primary">
            <Icon className="size-3.5" />
          </span>
          {title}
        </p>
        <Button variant="ghost" size="sm" className="gap-1.5 text-primary" render={<Link href={editHref} />}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function ReviewGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
          <dd className={cn("text-sm break-words", value ? "font-semibold text-foreground" : "text-muted-foreground/50")}>{value || "—"}</dd>
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

  return (
    <div className="space-y-6">
      <StepHeading index={5} title="Review your application" />

      <ReviewSection icon={User} title="Personal information" editHref={`${editBase}2`}>
        <ReviewGrid
          rows={[
            ["Full Name", t.full_name],
            ["Date of Birth", t.date_of_birth],
            ["Gender", t.gender],
            ["Nationality", t.nationality ? countryName(t.nationality) : ""],
            ["Passport Number", t.passport_number],
            ["Passport Expiry Date", t.passport_expiry],
            ["Email", c.email],
            ["Mobile", c.mobile],
          ]}
        />
      </ReviewSection>

      {application.applicant_type !== "single" ? (
        <ReviewSection icon={Users} title={`Members (${application.members.length})`} editHref={`${editBase}1`}>
          <div className="space-y-2">
            {application.members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{member.full_name}</span>
                <Badge className="border-transparent bg-muted text-[10px] text-muted-foreground">
                  {member.is_primary
                    ? "Primary Applicant"
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

      <ReviewSection icon={MapPin} title="Travel information" editHref={`${editBase}3`}>
        <ReviewGrid
          rows={[
            ["Date of Arrival", str(travel.arrival_date)],
            ["Date of Departure", str(travel.departure_date)],
            ["Purpose of Visit", str(travel.purpose).replace("_", " ")],
            ["Address / Hotel", str(travel.address)],
          ]}
        />
      </ReviewSection>

      {questions.length > 0 ? (
        <ReviewSection icon={Info} title="Additional Questions" editHref={`${editBase}3`}>
          <ReviewGrid rows={questions.map((q) => [q.label, answers[q.key] ?? ""])} />
        </ReviewSection>
      ) : null}

      <ReviewSection icon={FileText} title="Document Summary" editHref={`${editBase}4`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const doc = byKey.get(slot.key);
            return (
              <p key={slot.key} className="flex items-center gap-2 text-sm">
                {doc ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <X className="size-4 shrink-0 text-muted-foreground" />
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

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="applicationId" value={application.id} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        {termsAndConditions ? (
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">Terms &amp; Conditions</p>
            <div className="max-h-40 overflow-y-auto rounded-md bg-secondary/40 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {termsAndConditions}
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="agreeTerms" className="mt-0.5 size-4 accent-primary" required />
              <span>I agree to the Terms &amp; Conditions.</span>
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

        <div className="flex items-center justify-between">
          <BackButton href={`${editBase}4`} />
          <SubmitButton pendingText="Submitting…" className="gap-2">
            Proceed to Payment <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
