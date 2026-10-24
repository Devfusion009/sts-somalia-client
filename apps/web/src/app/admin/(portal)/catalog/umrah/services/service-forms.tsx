"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahService, deleteUmrahService } from "@/modules/umrah/service-admin-actions";
import type { ActionState } from "@/lib/auth/actions";
import {
  PRICE_UNIT_LABELS,
  ROOM_SHARING_OPTIONS,
  UMRAH_CATEGORIES,
  UMRAH_TIERS,
  type UmrahPriceUnit,
  type UmrahServiceCategory,
  type UmrahTier,
} from "@/modules/umrah/services";
import { ConfirmButton } from "@/components/ui/confirm-button";

export type AdminService = {
  id: string;
  category: UmrahServiceCategory;
  name: string;
  description: string | null;
  tier: UmrahTier | null;
  price: number;
  currency: string;
  price_unit: UmrahPriceUnit;
  star_rating: number | null;
  distance_to_haram_m: number | null;
  is_default: boolean;
  sort_order: number;
  status: string;
  sharing_prices: { sharing: number; price: number }[];
};

const HOTEL_CATEGORIES: UmrahServiceCategory[] = ["hotel_makkah", "hotel_madinah"];

/**
 * One form for both create and edit. `service` present means edit — the
 * alternative (a separate create form and a separate edit form) is how the
 * two drift apart and a field ends up settable in one and not the other.
 */
function ServiceFields({ service }: { service?: AdminService }) {
  const [category, setCategory] = useState<UmrahServiceCategory>(service?.category ?? "hotel_makkah");
  const isHotel = HOTEL_CATEGORIES.includes(category);

  return (
    <>
      <Field className="col-span-2">
        <FieldLabel htmlFor={`name-${service?.id ?? "new"}`}>Name</FieldLabel>
        <Input
          id={`name-${service?.id ?? "new"}`}
          name="name"
          defaultValue={service?.name ?? ""}
          placeholder="e.g. Swissotel Al Maqam"
          required
        />
      </Field>

      <Field>
        <FieldLabel>Category</FieldLabel>
        <Select
          name="category"
          value={category}
          onValueChange={(v) => setCategory(v as UmrahServiceCategory)}
        >
          <SelectTrigger className="w-full" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UMRAH_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Standard</FieldLabel>
        <Select name="tier" defaultValue={service?.tier ?? ""}>
          <SelectTrigger className="w-full" aria-label="Standard">
            <SelectValue placeholder="All standards" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All standards</SelectItem>
            {UMRAH_TIERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field className="col-span-2 sm:col-span-4">
        <FieldLabel htmlFor={`description-${service?.id ?? "new"}`}>Description</FieldLabel>
        <Textarea
          id={`description-${service?.id ?? "new"}`}
          name="description"
          rows={2}
          defaultValue={service?.description ?? ""}
          placeholder="Short description"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`price-${service?.id ?? "new"}`}>Price (USD)</FieldLabel>
        <Input
          id={`price-${service?.id ?? "new"}`}
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={service?.price ?? ""}
          className="tabular-nums"
          required
        />
      </Field>

      <Field>
        <FieldLabel>Charged</FieldLabel>
        <Select name="priceUnit" defaultValue={service?.price_unit ?? (isHotel ? "per_person_per_night" : "per_person")}>
          <SelectTrigger className="w-full" aria-label="Charged">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRICE_UNIT_LABELS) as UmrahPriceUnit[]).map((unit) => (
              <SelectItem key={unit} value={unit}>
                {PRICE_UNIT_LABELS[unit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isHotel ? (
        <>
          {ROOM_SHARING_OPTIONS.map((option) => {
            const id = `sharingPrice${option.value}-${service?.id ?? "new"}`;
            return (
              <Field key={option.value}>
                <FieldLabel htmlFor={id}>{option.label} (USD)</FieldLabel>
                <Input
                  id={id}
                  name={`sharingPrice${option.value}`}
                  type="number"
                  min={0.01}
                  step="0.01"
                  defaultValue={
                    service?.sharing_prices.find((p) => p.sharing === option.value)?.price ?? ""
                  }
                  placeholder={service ? String(service.price) : undefined}
                  className="tabular-nums"
                />
              </Field>
            );
          })}
          <Field>
            <FieldLabel htmlFor={`starRating-${service?.id ?? "new"}`}>Star rating</FieldLabel>
            <Input
              id={`starRating-${service?.id ?? "new"}`}
              name="starRating"
              type="number"
              min={1}
              max={5}
              defaultValue={service?.star_rating ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`distance-${service?.id ?? "new"}`}>Metres from the Haram</FieldLabel>
            <Input
              id={`distance-${service?.id ?? "new"}`}
              name="distanceToHaram"
              type="number"
              min={0}
              defaultValue={service?.distance_to_haram_m ?? ""}
            />
          </Field>
        </>
      ) : (
        // The columns still have to be submitted for a non-hotel row, or an
        // existing hotel's rating would silently survive a category change.
        <>
          <input type="hidden" name="starRating" value="" />
          <input type="hidden" name="distanceToHaram" value="" />
        </>
      )}

      <Field>
        <FieldLabel htmlFor={`sortOrder-${service?.id ?? "new"}`}>Sort order</FieldLabel>
        <Input
          id={`sortOrder-${service?.id ?? "new"}`}
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={service?.sort_order ?? 0}
        />
      </Field>

      <Field>
        <FieldLabel>Status</FieldLabel>
        <Select name="status" defaultValue={service?.status ?? "published"}>
          <SelectTrigger className="w-full" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <label className="col-span-2 flex h-8 items-center gap-2 self-end text-sm">
        <Checkbox name="isDefault" defaultChecked={service?.is_default ?? false} />
        Pre-select this for its standard
      </label>
    </>
  );
}


/**
 * Collapses the panel and refreshes the list once a save succeeds.
 *
 * The collapse is applied during render, not from an effect: setting state
 * inside an effect forces a second render pass, which react-hooks'
 * set-state-in-effect rule rejects. Comparing the action state against the
 * last one this component saw is React's documented way to respond to a
 * changed value without an effect — and it still lets the panel be reopened
 * afterwards, which keying off `state` alone would not.
 */
function useCloseOnSuccess(state: ActionState, setOpen: (open: boolean) => void) {
  const router = useRouter();
  const [seen, setSeen] = useState<ActionState>(null);

  if (state !== seen) {
    setSeen(state);
    if (state && !state.error) setOpen(false);
  }

  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);
}

function ServiceDialogBody({
  title,
  service,
  state,
  onCancel,
}: {
  title: string;
  service?: AdminService;
  state: ActionState;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}
      <div className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
        <ServiceFields service={service} />
      </div>
      {state?.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingText="Saving…">{service ? "Save changes" : "Save service"}</SubmitButton>
      </DialogFooter>
    </>
  );
}

export function NewServiceForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveUmrahService, null);
  useCloseOnSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden="true" /> Add service
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form action={formAction}>
          <ServiceDialogBody title="New service" state={state} onCancel={() => setOpen(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditServiceForm({ service }: { service: AdminService }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveUmrahService, null);
  useCloseOnSuccess(state, setOpen);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Edit ${service.name}`} title="Edit" />}>
          <Pencil />
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form action={formAction}>
            <ServiceDialogBody
              title={`Edit ${service.name}`}
              service={service}
              state={state}
              onCancel={() => setOpen(false)}
            />
          </form>
        </DialogContent>
      </Dialog>
      <form action={deleteUmrahService}>
        <input type="hidden" name="serviceId" value={service.id} />
        <ConfirmButton
          title="Delete this service?"
          description={service.name}
          aria-label={`Delete ${service.name}`}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </ConfirmButton>
      </form>
    </div>
  );
}
