"use client";

import { useState } from "react";
import { Plus, Trash2, PenLine, Check, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Single-select "multiple choice" card/pill picker — every one of the
 * wizard's short, fixed-option choices (business type, star rating,
 * cancellation policy, ...) used to be a native <select>, which hides every
 * option behind one click and a scroll on a field where there are only 3-7
 * choices total. Tapping the visible answer directly reads far friendlier,
 * and as a side benefit there's no popup at all, so it also sidesteps the
 * floating-menu-overlaps-the-field-below problem the old <select> was
 * deliberately choosing native-over-BaseUI to avoid.
 *
 * Submits via a hidden input, validated server-side like every other custom
 * picker in this file (BucketPicker, RepeatableRows) — native `required`
 * doesn't apply to hidden inputs, so it's intentionally omitted here too.
 */
export function OptionPicker({
  name,
  defaultValue,
  options,
  onChange,
  layout = "wrap",
}: {
  name: string;
  defaultValue?: string | null;
  options: Array<{ value: string; label: string; hint?: string; icon?: LucideIcon }>;
  onChange?: (value: string) => void;
  layout?: "wrap" | "stack" | "cards";
}) {
  const [selected, setSelected] = useState(defaultValue || "");

  function select(value: string) {
    setSelected(value);
    onChange?.(value);
  }

  if (layout === "cards") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input type="hidden" name={name} value={selected} />
        {options.map((option) => {
          const active = selected === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => select(option.value)}
              aria-pressed={active}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm font-medium transition-colors",
                active ? "border-primary bg-primary/5 text-foreground" : "border-border bg-transparent text-foreground hover:bg-accent"
              )}
            >
              {active ? (
                <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" />
                </span>
              ) : null}
              {Icon ? <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={layout === "stack" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
      <input type="hidden" name={name} value={selected} />
      {options.map((option) => {
        const active = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={active}
            className={cn(
              "border text-left transition-colors",
              layout === "stack" ? "w-full rounded-lg px-3 py-2.5 text-sm" : "rounded-full px-3 py-1.5 text-sm font-medium",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-foreground hover:bg-accent"
            )}
          >
            {option.label}
            {option.hint ? (
              <span className={cn("block text-xs font-normal", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Preset-bucket picker with a "Custom" pill that reveals a number input —
 * replaces a bare number field with quick-tap ranges (matches how a human
 * actually answers "years of experience" or "how many staff") while still
 * accepting an exact figure. Submits a single string value under `name`:
 * either the selected bucket label or the typed custom number, so the
 * server schema stays a plain optional string — no shape change needed.
 */
export function BucketPicker({
  name,
  defaultValue,
  options,
  customPlaceholder = "Exact number",
}: {
  name: string;
  defaultValue?: string;
  options: string[];
  customPlaceholder?: string;
}) {
  const startsCustom = !!defaultValue && !options.includes(defaultValue);
  const [selected, setSelected] = useState<string>(startsCustom ? "__custom__" : (defaultValue ?? ""));
  const [customValue, setCustomValue] = useState(startsCustom ? defaultValue! : "");

  const value = selected === "__custom__" ? customValue : selected;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSelected(option)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              selected === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-foreground hover:bg-accent"
            )}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelected("__custom__")}
          className={cn(
            "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            selected === "__custom__"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-dashed border-border bg-transparent text-muted-foreground hover:bg-accent"
          )}
        >
          <PenLine className="size-3.5" /> Custom
        </button>
      </div>
      {selected === "__custom__" ? (
        <Input
          type="number"
          min="0"
          autoFocus
          placeholder={customPlaceholder}
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          className="w-36"
        />
      ) : null}
    </div>
  );
}

/**
 * A small repeatable-rows editor (branches, social handles, ...) that
 * serializes its rows into one hidden JSON field on submit — avoids dynamic
 * `name="rows[0][x]"` array parsing on the server, and survives React 19's
 * post-action field reset since the hidden input's value is derived from
 * component state, not raw DOM value.
 */
export function RepeatableRows<T extends Record<string, string>>({
  hiddenFieldName,
  initialRows,
  emptyRow,
  fields,
  addLabel,
  max = 10,
}: {
  hiddenFieldName: string;
  initialRows: T[];
  emptyRow: T;
  fields: Array<{ key: keyof T; placeholder: string }>;
  addLabel: string;
  max?: number;
}) {
  const [rows, setRows] = useState<T[]>(initialRows.length > 0 ? initialRows : []);

  return (
    <div className="space-y-2">
      <input type="hidden" name={hiddenFieldName} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {fields.map((f) => (
            <Input
              key={String(f.key)}
              value={row[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], [f.key]: e.target.value };
                setRows(next);
              }}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      {rows.length < max ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRows([...rows, emptyRow])}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
