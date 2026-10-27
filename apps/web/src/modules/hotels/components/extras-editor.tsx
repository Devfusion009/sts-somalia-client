"use client";

import { useActionState, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/submit-button";
import {
  addHotelExtra,
  deleteHotelExtra,
  setHotelExtraActive,
  type PlanActionState,
} from "@/modules/hotels/rate-plan-actions";
import { EXTRA_UNIT_LABEL, EXTRA_UNIT_OPTIONS, type HotelExtra } from "@/modules/hotels/booking-options";

export function ExtrasEditor({ hotelId, extras, currency }: { hotelId: string; extras: HotelExtra[]; currency: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<PlanActionState, FormData>(async (prev, formData) => {
    const result = await addHotelExtra(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success("Extra added.", { position: "top-center" });
      formRef.current?.reset();
    }
    return result;
  }, null);

  return (
    <div className="space-y-5">
      {extras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No extras</p>
      ) : (
        <ul className="divide-y divide-border">
          {extras.map((extra) => (
            <li key={extra.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {extra.name}
                  {!extra.isActive ? <Badge variant="neutral">Paused</Badge> : null}
                </p>
                {extra.description ? <p className="text-xs text-muted-foreground">{extra.description}</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {currency} {extra.price.toFixed(2)}{" "}
                  <span className="font-normal text-muted-foreground">{EXTRA_UNIT_LABEL[extra.unit]}</span>
                </span>
                <form action={setHotelExtraActive}>
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <input type="hidden" name="id" value={extra.id} />
                  <input type="hidden" name="active" value={extra.isActive ? "false" : "true"} />
                  <Button type="submit" variant="outline" size="sm">
                    {extra.isActive ? "Pause" : "Activate"}
                  </Button>
                </form>
                <form action={deleteHotelExtra}>
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <input type="hidden" name="id" value={extra.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${extra.name}`}
                  >
                    <Trash2 />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="space-y-4 border-t border-border pt-5">
        <input type="hidden" name="hotelId" value={hotelId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="extra-name">Name</FieldLabel>
            <Input id="extra-name" name="name" placeholder="Airport transfer" maxLength={80} required aria-invalid={Boolean(state?.error)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="extra-price">Price ({currency})</FieldLabel>
              <Input id="extra-price" name="price" type="number" min={0.01} step="0.01" required className="tabular-nums" />
            </Field>
            <Field>
              <FieldLabel htmlFor="extra-unit">Charged</FieldLabel>
              <select id="extra-unit" name="unit" defaultValue="per_stay" className={NATIVE_SELECT_CLASS}>
                {EXTRA_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {EXTRA_UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="extra-description">Description</FieldLabel>
            <Textarea id="extra-description" name="description" rows={2} maxLength={500} />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton pendingText="Adding…">
            <Plus aria-hidden="true" /> Add extra
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
