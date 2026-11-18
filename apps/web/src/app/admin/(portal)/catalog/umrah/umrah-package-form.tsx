"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createUmrahPackage, updateUmrahPackage } from "@/modules/admin/actions";
import { UMRAH_INCLUDE_OPTIONS } from "@/modules/umrah/includes";
import type { Database } from "@/lib/types/database.types";

import { publicUmrahAgentContactSchema, type Airport } from "@sts/shared-types";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

type UmrahPackage = Database["public"]["Tables"]["umrah_packages"]["Row"];

export function UmrahPackageForm({ pkg, airports = [], requestFirstEnabled = false }: { pkg?: UmrahPackage; airports?: Airport[]; requestFirstEnabled?: boolean }) {
  const [requestFirst, setRequestFirst] = useState(requestFirstEnabled);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [packageType] = useState(pkg?.package_type ?? "group");
  const isPublic = packageType === "group";
  const [agentContacts, setAgentContacts] = useState(() => {
    const parsed = publicUmrahAgentContactSchema.array().safeParse(pkg?.agent_contacts ?? []);
    return parsed.success ? parsed.data : [];
  });
  const action = pkg ? updateUmrahPackage : createUmrahPackage;
  const [state, formAction] = useActionState(action, null);

  // Adjusted during render (not in an effect) per React's guidance for
  // deriving state from a state change; router.refresh() is the actual
  // side effect and stays in the effect below.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {pkg ? (
        <DialogTrigger render={<Button size="sm" variant="outline" aria-label={`Edit ${pkg.name}`} />}>
          <Pencil aria-hidden="true" /> Edit package & status
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus aria-hidden="true" /> Create package
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <form action={formAction} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
          <DialogHeader className="shrink-0 border-b border-border px-5 py-5 pr-12">
            <DialogTitle>{pkg ? "Edit Umrah package" : "Create Umrah package"}</DialogTitle>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-5">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <input type="hidden" name="packageType" value={packageType} />
            {!pkg && isPublic && requestFirstEnabled ? <fieldset className="space-y-4 rounded-xl border p-4"><legend className="px-2 font-medium">Group formation</legend><label className="flex gap-2"><input type="checkbox" name="requestFirst" checked={requestFirst} onChange={e=>setRequestFirst(e.target.checked)} />Request places before payment</label>{requestFirst ? <>
              <Field><FieldLabel htmlFor="formationClosesAt">Formation closes (Mogadishu)</FieldLabel><Input id="formationClosesAt" name="formationClosesAt" type="datetime-local" required /></Field>
              <Field><FieldLabel htmlFor="paymentCutoffAt">Final payment cutoff (Mogadishu)</FieldLabel><Input id="paymentCutoffAt" name="paymentCutoffAt" type="datetime-local" required /></Field>
              <Field><FieldLabel htmlFor="paymentWindowHours">Payment window (hours)</FieldLabel><Input id="paymentWindowHours" name="paymentWindowHours" type="number" min={1} max={168} defaultValue={48} required /></Field>
              <Field><FieldLabel htmlFor="requestTerms">Formation and cancellation terms</FieldLabel><Textarea id="requestTerms" name="requestTerms" minLength={10} maxLength={5000} required /></Field>
            </> : null}</fieldset> : null}
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" defaultValue={pkg?.name} required />
            </Field>
            {!pkg ? <div className="grid gap-4 sm:grid-cols-2">
              {([{ name: "originIata", label: "From" }, { name: "destinationIata", label: "To" }]).map(({ name, label }) => <Field key={name}>
                <FieldLabel htmlFor={name}>{label}</FieldLabel>
                <select id={name} name={name} required defaultValue="" className={NATIVE_SELECT_CLASS}>
                  <option value="" disabled>Select airport</option>
                  {airports.map((airport) => <option key={airport.iata_code} value={airport.iata_code}>{airport.city} ({airport.iata_code})</option>)}
                </select>
              </Field>)}
            </div> : null}
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" name="description" defaultValue={pkg?.description ?? ""} rows={2} required={isPublic} maxLength={4000} />
            </Field>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="durationDays">Duration (days)</FieldLabel>
                <Input id="durationDays" name="durationDays" type="number" min={isPublic ? 2 : 1} max={120} defaultValue={pkg?.duration_days} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="basePrice">Base price</FieldLabel>
                <Input
                  id="basePrice"
                  name="basePrice"
                  type="number"
                  min={isPublic ? 0.01 : 0}
                  step="0.01"
                  defaultValue={pkg?.base_price}
                  className="tabular-nums"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="currency">Currency</FieldLabel>
                <Input id="currency" name="currency" maxLength={3} className="uppercase" defaultValue={pkg?.currency ?? "USD"} required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="poolVisibility">Pool visibility</FieldLabel><select id="poolVisibility" name="poolVisibility" defaultValue={pkg?.pool_visibility ?? "public"} className={NATIVE_SELECT_CLASS}><option value="public">Public · customer bookings</option><option value="private">Private · assigned agency</option></select></Field>
              <Field><FieldLabel htmlFor="organizerName">Organizer</FieldLabel><Input id="organizerName" name="organizerName" defaultValue={pkg?.organizer_name ?? "STS Somalia"} required /></Field>
              <Field><FieldLabel htmlFor="organizerEmail">Organizer contact email</FieldLabel><Input id="organizerEmail" name="organizerEmail" type="email" defaultValue={pkg?.contact_person_email ?? ""} required={isPublic} /></Field>
            </div>
            {isPublic ? <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="contactPersonName">Responsible person</FieldLabel><Input id="contactPersonName" name="contactPersonName" required minLength={2} maxLength={120} defaultValue={pkg?.contact_person_name ?? ""} /></Field>
                <Field><FieldLabel htmlFor="contactPersonPhone">Contact number</FieldLabel><Input id="contactPersonPhone" name="contactPersonPhone" type="tel" required minLength={7} maxLength={40} defaultValue={pkg?.contact_person_phone ?? ""} /></Field>
                <Field><FieldLabel htmlFor="nightsMakkah">Makkah nights</FieldLabel><Input id="nightsMakkah" name="nightsMakkah" type="number" required min={0} max={119} defaultValue={pkg?.nights_makkah ?? ""} /></Field>
                <Field><FieldLabel htmlFor="nightsMadinah">Madinah nights</FieldLabel><Input id="nightsMadinah" name="nightsMadinah" type="number" required min={0} max={119} defaultValue={pkg?.nights_madinah ?? ""} /></Field>
                {!pkg ? <>
                  <Field><FieldLabel htmlFor="departureDate">Departure date</FieldLabel><Input id="departureDate" name="departureDate" type="date" required /></Field>
                  <Field><FieldLabel htmlFor="totalSeats">Total seats</FieldLabel><Input id="totalSeats" name="totalSeats" type="number" required min={1} max={10000} /></Field>
                </> : null}
              </div>
              <fieldset className="space-y-3"><legend className="text-sm font-medium">Public agent contacts</legend>
                {agentContacts.map((contact, index) => <div key={index} className="flex items-end gap-2">
                  <Field><FieldLabel htmlFor={`agent-name-${index}`}>Agent name</FieldLabel><Input id={`agent-name-${index}`} name="agentContactName" value={contact.name} required minLength={2} onChange={event => setAgentContacts(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></Field>
                  <Field><FieldLabel htmlFor={`agent-phone-${index}`}>Phone</FieldLabel><Input id={`agent-phone-${index}`} name="agentContactPhone" type="tel" value={contact.phone} required onChange={event => setAgentContacts(current => current.map((item, i) => i === index ? { ...item, phone: event.target.value } : item))} /></Field>
                  <Button type="button" variant="ghost" aria-label={`Remove agent contact ${index + 1}`} onClick={() => setAgentContacts(current => current.filter((_, i) => i !== index))}>Remove</Button>
                </div>)}
                <Button type="button" size="sm" variant="outline" disabled={agentContacts.length >= 20} onClick={() => setAgentContacts(current => [...current, { name: "", phone: "" }])}>Add agent contact</Button>
              </fieldset>
              {([
                ["facilities", "Facilities", pkg?.facilities],
                ["accommodationDetails", "Accommodation", pkg?.accommodation_details],
                ["mealsNote", "Food & meals", pkg?.meals_note],
                ["flightDetails", "Flights", pkg?.flight_details],
                ["transportDetails", "Transport", pkg?.transport_details],
              ] as const).map(([name, label, value]) => <Field key={name}><FieldLabel htmlFor={name}>{label}</FieldLabel><Textarea id={name} name={name} required rows={2} maxLength={name === "mealsNote" ? 500 : name === "facilities" ? 4000 : 2000} defaultValue={value ?? ""} /></Field>)}
            </> : null}
            <Field>
              <FieldLabel>Includes</FieldLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {UMRAH_INCLUDE_OPTIONS.map((option) => {
                  const checked = ((pkg?.includes as string[] | null) ?? []).includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                    >
                      <input
                        type="checkbox"
                        name="includes"
                        value={option.value}
                        defaultChecked={checked}
                        className="size-4 accent-primary"
                      />
                      {option.shortLabel}
                    </label>
                  );
                })}
              </div>
            </Field>
            {pkg ? <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select name="status" defaultValue={pkg?.status ?? "draft"}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending review</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </Field> : <input type="hidden" name="status" value="draft" />}
          </FieldGroup>

          <DialogFooter className="static m-0 shrink-0 rounded-none bg-muted/50 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{pkg ? "Save changes" : "Create & configure"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
