"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { SubmitButton } from "@/components/submit-button";
import { saveVisaCentre } from "@/modules/admin/visa-centre-actions";
import type { Database } from "@/lib/types/database.types";

type Centre = Database["public"]["Tables"]["visa_application_centres"]["Row"];

const TIMEZONES = [
  "Africa/Mogadishu",
  "Africa/Nairobi",
  "Africa/Addis_Ababa",
  "Africa/Djibouti",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "America/New_York",
];

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function CentreDialog({ centre }: { centre?: Centre }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveVisaCentre, null);
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state && !state.error) setOpen(false);
  }
  const id = centre?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {centre ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${centre.name}`} title="Edit" />}>
          <Pencil className="size-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus /> Add centre
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{centre ? "Edit centre" : "Add application centre"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {centre ? <input type="hidden" name="id" value={centre.id} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor={`c-name-${id}`}>
              <Input id={`c-name-${id}`} name="name" defaultValue={centre?.name} placeholder="VFS Global Nairobi" required />
            </Field>
            <Field label="Provider" htmlFor={`c-prov-${id}`}>
              <Input id={`c-prov-${id}`} name="provider" defaultValue={centre?.provider ?? ""} placeholder="VFS, TLS, BLS, Embassy" />
            </Field>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <CountrySearchSelect name="countryCode" defaultValue={centre?.country_code} placeholder="Select country" />
            </div>
            <Field label="City" htmlFor={`c-city-${id}`}>
              <Input id={`c-city-${id}`} name="city" defaultValue={centre?.city} required />
            </Field>
            <Field label="Timezone" htmlFor={`c-tz-${id}`}>
              <Input
                id={`c-tz-${id}`}
                name="timezone"
                list="centre-timezones"
                defaultValue={centre?.timezone ?? "Africa/Mogadishu"}
                required
              />
            </Field>
            <Field label="Phone" htmlFor={`c-phone-${id}`}>
              <Input id={`c-phone-${id}`} name="phone" defaultValue={centre?.phone ?? ""} />
            </Field>
          </div>
          <Field label="Address" htmlFor={`c-addr-${id}`}>
            <Input id={`c-addr-${id}`} name="address" defaultValue={centre?.address ?? ""} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Submission hours" htmlFor={`c-sub-${id}`}>
              <Input id={`c-sub-${id}`} name="submissionHours" defaultValue={centre?.submission_hours ?? ""} placeholder="Sun–Thu 08:00–15:00" />
            </Field>
            <Field label="Passport collection hours" htmlFor={`c-col-${id}`}>
              <Input id={`c-col-${id}`} name="collectionHours" defaultValue={centre?.collection_hours ?? ""} placeholder="Sun–Thu 15:00–17:00" />
            </Field>
            <Field label="Email" htmlFor={`c-email-${id}`}>
              <Input id={`c-email-${id}`} name="email" type="email" defaultValue={centre?.email ?? ""} />
            </Field>
            <Field label="Website" htmlFor={`c-web-${id}`}>
              <Input id={`c-web-${id}`} name="websiteUrl" type="url" defaultValue={centre?.website_url ?? ""} />
            </Field>
          </div>
          <Field label="Appointment booking link" htmlFor={`c-appt-${id}`}>
            <Input id={`c-appt-${id}`} name="appointmentUrl" type="url" defaultValue={centre?.appointment_url ?? ""} />
          </Field>
          <datalist id="centre-timezones">
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <SubmitButton pendingText="Saving…">{centre ? "Save" : "Add centre"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
