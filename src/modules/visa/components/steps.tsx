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
import { COUNTRY_OPTIONS, countryFlag, countryName } from "@/lib/countries";
import {
  saveApplicantType,
  saveVisaMember,
  removeVisaMember,
  savePersonalInfo,
  saveTravelInfo,
  uploadVisaDocument,
  removeVisaDocument,
  continueFromDocuments,
  submitVisaApplication,
  type ActionState,
} from "@/modules/visa/actions";
import { RELATIONSHIPS, parseDocumentSlots, type DocumentSlot } from "@/modules/visa/schemas";
import type { WizardApplication } from "@/modules/visa/queries";

/* ------------------------------------------------------------------------- */
/* Shared bits                                                               */
/* ------------------------------------------------------------------------- */

function StepHeading({ index, title, subtitle }: { index?: number; title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-heading text-xl font-bold">
        {index ? `${index}. ` : ""}
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-chart-3/10 px-4 py-3 text-sm text-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-chart-3" />
      <div>{children}</div>
    </div>
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

const COUNTRY_SELECT_ITEMS = COUNTRY_OPTIONS.map(([code, label]) => ({
  value: code,
  label: `${countryFlag(code)} ${label}`,
}));

function CountrySelect({
  name,
  id,
  defaultValue,
  placeholder,
}: {
  name: string;
  id?: string;
  defaultValue?: string | null;
  placeholder: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? undefined} items={COUNTRY_SELECT_ITEMS}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {COUNTRY_SELECT_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
            <CountrySelect
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
}: {
  application: WizardApplication;
  backHref: string;
}) {
  const [state, formAction] = useActionState(saveApplicantType, null);
  const [applicantType, setApplicantType] = useState(application.applicant_type);
  const members = application.members;
  const others = members.filter((m) => !m.is_primary);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <StepHeading index={1} title="Applicant Type" subtitle="Please select who is applying for the visa." />
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
          <StepHeading
            index={2}
            title={applicantType === "family" ? "Family Details" : "Group Details"}
            subtitle={
              applicantType === "family"
                ? "Please add all family members who will be included in this application."
                : "Please add all group members who will be included in this application."
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-chart-3/10 px-4 py-3">
            <p className="flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-chart-3" />
              <span>
                Add all members who will travel on this application.
                {applicantType === "family"
                  ? " You can add spouse, children, parents and other dependents."
                  : " Each member needs their own passport details."}
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

          {others.length > 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
              <CheckCircle2 className="size-4 shrink-0" />
              Make sure all names match the passports and all information is correct.
            </p>
          ) : null}
        </section>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="applicantType" value={applicantType} />
        <ErrorAlert state={state} />
        <div className="flex items-center justify-between">
          <BackButton href={backHref} />
          <SubmitButton pendingText="Saving…" className="gap-2">
            Save &amp; Next <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Step 2 — personal information                                              */
/* ------------------------------------------------------------------------- */

export function StepPersonalInfo({ application }: { application: WizardApplication }) {
  const [state, formAction] = useActionState(savePersonalInfo, null);
  const t = (application.traveler_details ?? {}) as Record<string, string>;
  const c = (application.contact_details ?? {}) as Record<string, string>;
  // After a validation error, prefer what the user just typed over saved data.
  const v = state?.values ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="applicationId" value={application.id} />
      <StepHeading
        title="Personal Information"
        subtitle="Please enter your personal details as shown in your passport."
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Full Name (as in passport)" htmlFor="fullName" required>
          <Input id="fullName" name="fullName" defaultValue={v.fullName ?? t.full_name ?? ""} placeholder="Enter full name" required />
        </Field>
        <Field label="Date of Birth" htmlFor="dateOfBirth" required>
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
          <CountrySelect name="nationality" defaultValue={v.nationality ?? t.nationality ?? "SO"} placeholder="Select nationality" />
        </Field>
        <Field label="Passport Number" htmlFor="passportNumber" required>
          <Input id="passportNumber" name="passportNumber" defaultValue={v.passportNumber ?? t.passport_number ?? ""} placeholder="Enter passport number" required />
        </Field>
        <Field label="Passport Expiry Date" htmlFor="passportExpiry" required>
          <Input id="passportExpiry" name="passportExpiry" type="date" defaultValue={v.passportExpiry ?? t.passport_expiry ?? ""} required />
        </Field>
        <Field label="Place of Birth" htmlFor="placeOfBirth" required>
          <Input id="placeOfBirth" name="placeOfBirth" defaultValue={v.placeOfBirth ?? t.place_of_birth ?? ""} placeholder="Enter place of birth" required />
        </Field>
        <Field label="Country of Birth" required>
          <CountrySelect name="countryOfBirth" defaultValue={v.countryOfBirth ?? t.country_of_birth ?? "SO"} placeholder="Select country" />
        </Field>
        <Field label="Marital Status" required>
          <LabeledSelect
            name="maritalStatus"
            defaultValue={v.maritalStatus ?? t.marital_status}
            placeholder="Select status"
            options={[
              { value: "single", label: "Single" },
              { value: "married", label: "Married" },
              { value: "divorced", label: "Divorced" },
              { value: "widowed", label: "Widowed" },
            ]}
          />
        </Field>
        <Field label="Email Address" htmlFor="email" required>
          <Input id="email" name="email" type="email" defaultValue={v.email ?? c.email ?? ""} placeholder="Enter email address" required />
        </Field>
        <Field label="Mobile Number" htmlFor="mobile" required>
          <Input id="mobile" name="mobile" type="tel" defaultValue={v.mobile ?? c.mobile ?? ""} placeholder="+252 61 XXXXXXX" required />
        </Field>
        <Field label="Occupation" htmlFor="occupation" required>
          <Input id="occupation" name="occupation" defaultValue={v.occupation ?? t.occupation ?? ""} placeholder="Enter occupation" required />
        </Field>
      </div>

      <ErrorAlert state={state} />

      <div className="flex items-center justify-between">
        <BackButton href={`/visa/apply/${application.id}?step=1`} />
        <SubmitButton pendingText="Saving…" className="gap-2">
          Save &amp; Continue <ArrowRight className="size-4" />
        </SubmitButton>
      </div>

      <InfoBanner>
        Please ensure all information matches your passport and travel documents to avoid delays.
      </InfoBanner>
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
}: {
  application: WizardApplication;
  destination: string;
}) {
  const [state, formAction] = useActionState(saveTravelInfo, null);
  const t = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const v = state?.values ?? {};
  const str = (key: string) => (typeof t[key] === "string" ? (t[key] as string) : "");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="applicationId" value={application.id} />
      <StepHeading
        title="Travel Information"
        subtitle="Please enter your travel details for your visa application."
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={`Date of Arrival in ${destination}`} htmlFor="arrivalDate" required>
          <Input id="arrivalDate" name="arrivalDate" type="date" defaultValue={v.arrivalDate ?? str("arrival_date")} required />
        </Field>
        <Field label="Port of Entry" htmlFor="portOfEntry" required>
          <Input id="portOfEntry" name="portOfEntry" defaultValue={v.portOfEntry ?? str("port_of_entry")} placeholder="e.g. Dubai International Airport" required />
        </Field>
        <Field label="Flight Number (if available)" htmlFor="flightNumber">
          <Input id="flightNumber" name="flightNumber" defaultValue={v.flightNumber ?? str("flight_number")} placeholder="Enter flight number" />
        </Field>
        <Field label={`Date of Departure from ${destination}`} htmlFor="departureDate" required>
          <Input id="departureDate" name="departureDate" type="date" defaultValue={v.departureDate ?? str("departure_date")} required />
        </Field>
        <Field label="Port of Exit" htmlFor="portOfExit">
          <Input id="portOfExit" name="portOfExit" defaultValue={v.portOfExit ?? str("port_of_exit")} placeholder="e.g. Dubai International Airport" />
        </Field>
        <Field label="Return Flight Number (if available)" htmlFor="returnFlightNumber">
          <Input id="returnFlightNumber" name="returnFlightNumber" defaultValue={v.returnFlightNumber ?? str("return_flight_number")} placeholder="Enter return flight number" />
        </Field>
        <Field label="Purpose of Visit" required>
          <LabeledSelect
            name="purposeOfVisit"
            defaultValue={v.purposeOfVisit ?? str("purpose")}
            placeholder="Select purpose of visit"
            options={[
              { value: "tourism", label: "Tourism" },
              { value: "business", label: "Business" },
              { value: "family_visit", label: "Family Visit" },
              { value: "medical", label: "Medical" },
              { value: "transit", label: "Transit" },
              { value: "umrah", label: "Umrah" },
              { value: "other", label: "Other" },
            ]}
          />
        </Field>
        <Field label="Who will pay for your trip?" required>
          <LabeledSelect
            name="payer"
            defaultValue={v.payer ?? str("payer")}
            placeholder="Select sponsor type"
            options={[
              { value: "self", label: "Self" },
              { value: "sponsor", label: "Sponsor" },
              { value: "company", label: "Company" },
              { value: "relative", label: "Relative" },
            ]}
          />
        </Field>
        <Field label="Sponsor / Company Name" htmlFor="sponsorName">
          <Input id="sponsorName" name="sponsorName" defaultValue={v.sponsorName ?? str("sponsor_name")} placeholder="Enter sponsor or company name" />
        </Field>
      </div>

      <Field label={`Address in ${destination} (Hotel or Contact Address)`} htmlFor="addressAtDestination" required>
        <Textarea
          id="addressAtDestination"
          name="addressAtDestination"
          rows={2}
          defaultValue={v.addressAtDestination ?? str("address")}
          placeholder={`Enter hotel name or contact address in ${destination}`}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <YesNo
          name="hasRelatives"
          label={`Do you have any relatives or friends in ${destination}?`}
          defaultValue={t.has_relatives === true ? "yes" : "no"}
        />
        <YesNo
          name="visitedBefore"
          label={`Have you visited ${destination} before?`}
          defaultValue={t.visited_before === true ? "yes" : "no"}
        />
      </div>

      <ErrorAlert state={state} />

      <div className="flex items-center justify-between">
        <BackButton href={`/visa/apply/${application.id}?step=2`} />
        <SubmitButton pendingText="Saving…" className="gap-2">
          Save &amp; Continue <ArrowRight className="size-4" />
        </SubmitButton>
      </div>

      <InfoBanner>
        Please ensure all travel details are accurate. Incorrect information may cause delays or
        rejection of your visa.
      </InfoBanner>
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

function UploadSlot({
  applicationId,
  slot,
  existing,
}: {
  applicationId: string;
  slot: DocumentSlot;
  existing?: WizardApplication["documents"][number];
}) {
  const [state, formAction, pending] = useActionState(uploadVisaDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}

export function StepDocuments({ application }: { application: WizardApplication }) {
  const [state, formAction] = useActionState(continueFromDocuments, null);
  const slots = parseDocumentSlots(application.visa_type?.required_documents);
  const byKey = new Map(application.documents.map((d) => [d.document_type, d]));

  return (
    <div className="space-y-6">
      <StepHeading
        title="Document Upload"
        subtitle="Please upload clear scanned copies or photos of the required documents."
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        {slots.map((slot) => (
          <UploadSlot
            key={slot.key}
            applicationId={application.id}
            slot={slot}
            existing={byKey.get(slot.key)}
          />
        ))}
      </div>

      <ErrorAlert state={state} />

      <form action={formAction} className="flex items-center justify-between">
        <input type="hidden" name="applicationId" value={application.id} />
        <BackButton href={`/visa/apply/${application.id}?step=3`} />
        <SubmitButton pendingText="Checking…" className="gap-2">
          Save &amp; Continue <ArrowRight className="size-4" />
        </SubmitButton>
      </form>

      <InfoBanner>
        Make sure all documents are clear, valid and match the information provided in the
        application.
      </InfoBanner>
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
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StepReview({ application }: { application: WizardApplication }) {
  const [state, formAction] = useActionState(submitVisaApplication, null);
  const t = (application.traveler_details ?? {}) as Record<string, string>;
  const c = (application.contact_details ?? {}) as Record<string, string>;
  const travel = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const slots = parseDocumentSlots(application.visa_type?.required_documents);
  const byKey = new Map(application.documents.map((d) => [d.document_type, d]));
  const editBase = `/visa/apply/${application.id}?step=`;

  const str = (v: unknown) => (typeof v === "string" ? v : "");

  return (
    <div className="space-y-6">
      <StepHeading
        title="Review Your Application"
        subtitle="Please review all the information below before proceeding to payment."
      />

      <ReviewSection icon={User} title="Personal Information" editHref={`${editBase}2`}>
        <ReviewGrid
          rows={[
            ["Full Name", t.full_name],
            ["Date of Birth", t.date_of_birth],
            ["Nationality", t.nationality ? countryName(t.nationality) : ""],
            ["Passport Number", t.passport_number],
            ["Passport Expiry Date", t.passport_expiry],
            ["Place of Birth", t.place_of_birth],
            ["Gender", t.gender],
            ["Marital Status", t.marital_status],
            ["Email", c.email],
            ["Mobile", c.mobile],
            ["Occupation", t.occupation],
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

      <ReviewSection icon={ArrowRight} title="Travel Information" editHref={`${editBase}3`}>
        <ReviewGrid
          rows={[
            ["Date of Arrival", str(travel.arrival_date)],
            ["Port of Entry", str(travel.port_of_entry)],
            ["Date of Departure", str(travel.departure_date)],
            ["Port of Exit", str(travel.port_of_exit)],
            ["Purpose of Visit", str(travel.purpose).replace("_", " ")],
            ["Who will pay?", str(travel.payer)],
            ["Sponsor / Company", str(travel.sponsor_name)],
            ["Address / Hotel", str(travel.address)],
          ]}
        />
      </ReviewSection>

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

      <InfoBanner>
        Please ensure all information is correct. Once submitted, changes may not be possible.
      </InfoBanner>
    </div>
  );
}
