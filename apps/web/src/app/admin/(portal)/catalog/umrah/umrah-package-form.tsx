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

import type { Airport } from "@sts/shared-types";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

type UmrahPackage = Database["public"]["Tables"]["umrah_packages"]["Row"];

export function UmrahPackageForm({ pkg, airports = [] }: { pkg?: UmrahPackage; airports?: Airport[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
            <Field>
              <FieldLabel htmlFor="packageType">Package type</FieldLabel>
              <select id="packageType" name="packageType" defaultValue={pkg?.package_type ?? "group"} className={NATIVE_SELECT_CLASS}>
                <option value="group">Group package</option><option value="private">Private package · admin confirmation</option>
              </select>
            </Field>
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
              <Textarea id="description" name="description" defaultValue={pkg?.description ?? ""} rows={2} />
            </Field>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="durationDays">Duration (days)</FieldLabel>
                <Input id="durationDays" name="durationDays" type="number" min={1} defaultValue={pkg?.duration_days} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="basePrice">Base price</FieldLabel>
                <Input
                  id="basePrice"
                  name="basePrice"
                  type="number"
                  min={0}
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
