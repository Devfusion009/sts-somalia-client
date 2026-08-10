"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Plus, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

/** Storage shape — matches business_details.roomTypes[] in the DB exactly (no UI-only fields). */
export type RoomTypeRow = {
  typeName: string;
  count: string;
  maxOccupancy: string;
  basePriceUsd: string;
};

type EditableRow = RoomTypeRow & { id: string; removing?: boolean };
type FieldKey = "typeName" | "count" | "maxOccupancy" | "basePriceUsd";

const ROOM_TYPE_GROUPS: ReadonlyArray<{ label: string; items: readonly string[] }> = [
  {
    label: "Common",
    items: [
      "Standard Room",
      "Deluxe Room",
      "Superior Room",
      "Executive Room",
      "Family Room",
      "Single Room",
      "Twin Room",
      "Triple/Quad Room",
    ],
  },
  { label: "Suites", items: ["Junior Suite", "Suite", "Presidential Suite"] },
  {
    label: "Resort & Luxury",
    items: ["Villa", "Bungalow/Cottage", "Ocean View Room", "Garden View Room", "Pool View Room"],
  },
  { label: "Budget", items: ["Economy Room", "Dormitory/Shared Room"] },
  { label: "Accessibility", items: ["Accessible Room"] },
];

function validatePositiveInt(value: string, noun: string): string | null {
  if (!value.trim()) return `Enter ${noun}.`;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return "Enter a whole number of 1 or more.";
  return null;
}

function validateRate(raw: string): string | null {
  if (!raw.trim()) return "Enter a nightly rate.";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "Enter a number greater than 0.";
  return null;
}

/** Strips everything but digits and a single decimal point as the user types. */
function sanitizeRateInput(input: string): string {
  let cleaned = input.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  return cleaned;
}

/** Adds thousands separators for display; the raw digits (no commas) are what's actually stored/submitted. */
function formatRateDisplay(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

function hasAnyData(row: RoomTypeRow): boolean {
  return !!(row.typeName.trim() || row.count.trim() || row.maxOccupancy.trim() || row.basePriceUsd.trim());
}

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return `room-type-${rowIdCounter}`;
}
function emptyRow(): EditableRow {
  return { id: nextRowId(), typeName: "", count: "", maxOccupancy: "", basePriceUsd: "" };
}

/**
 * Room type "MCQ-or-custom" combobox — Base UI's Combobox primitive (same
 * family as the ui/select.tsx, ui/popover.tsx wrappers elsewhere in this
 * app) gives correct APG combobox keyboard nav and ARIA for free, so this
 * doesn't hand-roll its own listbox. `inputValue` is the single source of
 * truth submitted for the row: picking a suggestion just fills the input
 * with that text, and typing anything else — matched or not — is accepted
 * as a custom room type. Nothing extra is needed to "confirm" a custom
 * value; whatever is currently typed IS the value.
 */
function RoomTypeCombobox({
  id,
  value,
  onValueChange,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <Combobox
      items={ROOM_TYPE_GROUPS}
      inputValue={value}
      onInputValueChange={(next) => onValueChange(next)}
      value={value || null}
      onValueChange={(next) => onValueChange(typeof next === "string" ? next : "")}
      autoHighlight
    >
      <ComboboxInputGroup>
        <ComboboxInput
          id={id}
          placeholder="e.g. Deluxe Room"
          onBlur={onBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty>No matching room type — your typed name will be used as a custom room type.</ComboboxEmpty>
            <ComboboxList>
              {(group: { label: string; items: readonly string[] }) => (
                <ComboboxGroup key={group.label} items={group.items}>
                  <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel>
                  {group.items.map((item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </Combobox>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function RoomTypesField({ initial }: { initial: RoomTypeRow[] }) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    initial.length > 0 ? initial.map((r) => ({ ...r, id: nextRowId() })) : [emptyRow()]
  );
  const [touched, setTouched] = useState<Record<string, Set<FieldKey>>>({});
  const [forceValidateAll, setForceValidateAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Surfaces every row's inline errors the moment "Continue" is attempted,
  // not just on blur — the server (saveStep3) stays the real gatekeeper for
  // whether the step actually advances; this only makes the hints visible
  // earlier than "type something, tab away, notice nothing happened."
  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const handler = () => setForceValidateAll(true);
    form.addEventListener("submit", handler);
    return () => form.removeEventListener("submit", handler);
  }, []);

  function updateRow(id: string, patch: Partial<RoomTypeRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function markTouched(id: string, field: FieldKey) {
    setTouched((prev) => {
      const next = { ...prev, [id]: new Set(prev[id] ?? []) };
      next[id].add(field);
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function requestRemove(id: string) {
    const row = rows.find((r) => r.id === id);
    if (row && hasAnyData(row)) {
      setConfirmDeleteId(id);
      return;
    }
    removeRow(id);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, removing: true } : r)));
    // Matches the row's own transition-duration below — lets the fade/scale
    // play before the row actually leaves the DOM.
    setTimeout(() => setRows((prev) => prev.filter((r) => r.id !== id)), 180);
  }

  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.typeName.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const serialized = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => !r.removing)
          .map(({ typeName, count, maxOccupancy, basePriceUsd }) => ({ typeName, count, maxOccupancy, basePriceUsd }))
      ),
    [rows]
  );

  const confirmDeleteRow = confirmDeleteId ? rows.find((r) => r.id === confirmDeleteId) : null;

  return (
    <div className="space-y-3" ref={containerRef}>
      <input type="hidden" name="roomTypesJson" value={serialized} />

      <div className="flex items-center gap-1.5">
        <Label>Room types *</Label>
        <Tooltip>
          <TooltipTrigger
            render={
              <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="About the room type field">
                <Info className="size-3.5" />
              </button>
            }
          />
          <TooltipContent>Pick a common room type from the list, or type your own name.</TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xs text-muted-foreground">
        Add each room category you&apos;ll list with its inventory count, max occupancy, and an indicative nightly
        rate — you can fine-tune rates and availability later in the partner portal.
      </p>

      <div className="space-y-2">
        {rows.map((row, index) => {
          const isDuplicate = row.typeName.trim() !== "" && (duplicateCounts.get(row.typeName.trim().toLowerCase()) ?? 0) > 1;
          const rowTouched = touched[row.id] ?? new Set<FieldKey>();
          const shouldShow = (field: FieldKey) => forceValidateAll || rowTouched.has(field);

          const typeNameError = shouldShow("typeName")
            ? !row.typeName.trim()
              ? "Enter a room type."
              : isDuplicate
                ? "This room type is already used in another row."
                : null
            : null;
          const countError = shouldShow("count") ? validatePositiveInt(row.count, "the number of rooms") : null;
          const maxOccupancyError = shouldShow("maxOccupancy") ? validatePositiveInt(row.maxOccupancy, "max occupancy") : null;
          const rateError = shouldShow("basePriceUsd") ? validateRate(row.basePriceUsd) : null;

          const typeNameErrorId = `${row.id}-typeName-error`;
          const countErrorId = `${row.id}-count-error`;
          const maxOccupancyErrorId = `${row.id}-maxOccupancy-error`;
          const rateErrorId = `${row.id}-rate-error`;

          return (
            <div
              key={row.id}
              className={cn(
                "rounded-lg border border-border p-3 transition-all duration-200",
                row.removing ? "-translate-y-1 scale-[0.98] opacity-0" : "animate-in fade-in-0 slide-in-from-top-1"
              )}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
                <div className="space-y-1">
                  <Label htmlFor={`${row.id}-typeName`} className="text-xs font-normal text-muted-foreground">
                    Room type
                  </Label>
                  <RoomTypeCombobox
                    id={`${row.id}-typeName`}
                    value={row.typeName}
                    onValueChange={(v) => updateRow(row.id, { typeName: v })}
                    onBlur={() => markTouched(row.id, "typeName")}
                    invalid={!!typeNameError}
                    describedBy={typeNameError ? typeNameErrorId : undefined}
                  />
                  <FieldError id={typeNameErrorId} message={typeNameError} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`${row.id}-count`} className="text-xs font-normal text-muted-foreground">
                    Rooms
                  </Label>
                  <Input
                    id={`${row.id}-count`}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={row.count}
                    onChange={(e) => updateRow(row.id, { count: e.target.value })}
                    onBlur={() => markTouched(row.id, "count")}
                    aria-invalid={!!countError}
                    aria-describedby={countError ? countErrorId : undefined}
                  />
                  <FieldError id={countErrorId} message={countError} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`${row.id}-maxOccupancy`} className="text-xs font-normal text-muted-foreground">
                    Max guests
                  </Label>
                  <Input
                    id={`${row.id}-maxOccupancy`}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={row.maxOccupancy}
                    onChange={(e) => updateRow(row.id, { maxOccupancy: e.target.value })}
                    onBlur={() => markTouched(row.id, "maxOccupancy")}
                    aria-invalid={!!maxOccupancyError}
                    aria-describedby={maxOccupancyError ? maxOccupancyErrorId : undefined}
                  />
                  <FieldError id={maxOccupancyErrorId} message={maxOccupancyError} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`${row.id}-rate`} className="text-xs font-normal text-muted-foreground">
                    Rate / night
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id={`${row.id}-rate`}
                      type="text"
                      inputMode="decimal"
                      className="pl-5"
                      value={formatRateDisplay(row.basePriceUsd)}
                      onChange={(e) => updateRow(row.id, { basePriceUsd: sanitizeRateInput(e.target.value) })}
                      onBlur={() => markTouched(row.id, "basePriceUsd")}
                      aria-invalid={!!rateError}
                      aria-describedby={rateError ? rateErrorId : undefined}
                    />
                  </div>
                  <FieldError id={rateErrorId} message={rateError} />
                </div>

                <div className="flex sm:pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => requestRemove(row.id)}
                    disabled={rows.length === 1}
                    aria-label={`Remove room type row ${index + 1}`}
                    className="shrink-0 text-destructive hover:text-destructive disabled:text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
        <Plus className="size-3.5" /> Add room type
      </Button>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this room type?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteRow?.typeName ? `"${confirmDeleteRow.typeName}" has` : "This row has"} details filled in
              — removing it discards them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId) removeRow(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
