"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
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
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`name-${service?.id ?? "new"}`}>Name</Label>
        <Input
          id={`name-${service?.id ?? "new"}`}
          name="name"
          defaultValue={service?.name ?? ""}
          placeholder="e.g. Swissotel Al Maqam"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          name="category"
          value={category}
          onValueChange={(v) => setCategory(v as UmrahServiceCategory)}
        >
          <SelectTrigger className="w-full">
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
      </div>

      <div className="space-y-2">
        <Label>Standard</Label>
        <Select name="tier" defaultValue={service?.tier ?? ""}>
          <SelectTrigger className="w-full">
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
      </div>

      <div className="space-y-2 sm:col-span-4">
        <Label htmlFor={`description-${service?.id ?? "new"}`}>Description</Label>
        <Textarea
          id={`description-${service?.id ?? "new"}`}
          name="description"
          rows={2}
          defaultValue={service?.description ?? ""}
          placeholder="One line the customer sees under the name."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`price-${service?.id ?? "new"}`}>Price (USD)</Label>
        <Input
          id={`price-${service?.id ?? "new"}`}
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={service?.price ?? ""}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Charged</Label>
        <Select name="priceUnit" defaultValue={service?.price_unit ?? (isHotel ? "per_person_per_night" : "per_person")}>
          <SelectTrigger className="w-full">
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
      </div>

      {isHotel ? (
        <>
          {ROOM_SHARING_OPTIONS.map((option) => {
            const id = `sharingPrice${option.value}-${service?.id ?? "new"}`;
            return (
              <div key={option.value} className="space-y-2">
                <Label htmlFor={id}>{option.label} (USD)</Label>
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
                />
              </div>
            );
          })}
          <div className="space-y-2">
            <Label htmlFor={`starRating-${service?.id ?? "new"}`}>Star rating</Label>
            <Input
              id={`starRating-${service?.id ?? "new"}`}
              name="starRating"
              type="number"
              min={1}
              max={5}
              defaultValue={service?.star_rating ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`distance-${service?.id ?? "new"}`}>Metres from the Haram</Label>
            <Input
              id={`distance-${service?.id ?? "new"}`}
              name="distanceToHaram"
              type="number"
              min={0}
              defaultValue={service?.distance_to_haram_m ?? ""}
            />
          </div>
        </>
      ) : (
        // The columns still have to be submitted for a non-hotel row, or an
        // existing hotel's rating would silently survive a category change.
        <>
          <input type="hidden" name="starRating" value="" />
          <input type="hidden" name="distanceToHaram" value="" />
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor={`sortOrder-${service?.id ?? "new"}`}>Sort order</Label>
        <Input
          id={`sortOrder-${service?.id ?? "new"}`}
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={service?.sort_order ?? 0}
        />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select name="status" defaultValue={service?.status ?? "published"}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
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

export function NewServiceForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveUmrahService, null);
  useCloseOnSuccess(state, setOpen);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="size-4" /> Add service
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold">New service</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <ServiceFields />
      </div>
      {state?.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="mt-4 flex justify-end">
        <SubmitButton pendingText="Saving…">Save service</SubmitButton>
      </div>
    </form>
  );
}

export function EditServiceForm({ service }: { service: AdminService }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveUmrahService, null);
  useCloseOnSuccess(state, setOpen);

  if (!open) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" /> Edit
        </Button>
        <form action={deleteUmrahService}>
          <input type="hidden" name="serviceId" value={service.id} />
          <ConfirmButton
            title="Delete this service?"
            description={service.name}
            aria-label="Delete service"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </ConfirmButton>
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full rounded-xl border border-primary/40 bg-card p-5">
      <input type="hidden" name="serviceId" value={service.id} />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold">Edit “{service.name}”</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <ServiceFields service={service} />
      </div>
      {state?.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
