"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./hotel-workspace.module.css";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { addRateRule, deleteRateRule, type RateActionState } from "@/modules/hotels/rate-actions";
import type { RateRule } from "@/modules/hotels/rate-queries";
import { dateSpan } from "@/lib/money";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeDays(weekdays: number[] | null) {
  if (!weekdays) return "Every day";
  return [...weekdays].sort((a, b) => a - b).map((d) => DAYS[d]).join(", ");
}

function describeAdjustment(rule: RateRule) {
  if (rule.adjustment === "fixed") return `Set to ${rule.value.toFixed(2)}`;
  return `${rule.value > 0 ? "+" : ""}${rule.value}%`;
}

export function RateRulesEditor({
  hotelId,
  rules,
  roomTypes,
  today,
}: {
  hotelId: string;
  rules: RateRule[];
  roomTypes: Array<{ id: string; name: string }>;
  today: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [roomId, setRoomId] = useState("all");
  const [adjustment, setAdjustment] = useState<"percent" | "fixed">("percent");
  const [days, setDays] = useState<number[]>([]);
  const [state, formAction] = useActionState<RateActionState, FormData>(async (prev, formData) => {
    const result = await addRateRule(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success("Rule added.", { position: "top-center" });
      formRef.current?.reset();
      setDays([]);
      setRoomId("all");
    }
    return result;
  }, null);

  return (
    <div className="space-y-5">
      {rules.length > 0 ? (
        <ul className="divide-y divide-border">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {rule.roomName ?? "All room types"} · {dateSpan(rule.dateStart, rule.dateEnd)} · {describeDays(rule.weekdays)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{describeAdjustment(rule)}</span>
                <form action={deleteRateRule}>
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${rule.name}`}
                  >
                    <Trash2 />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <details className={styles.editor}>
        <summary>Create pricing rule<Plus aria-hidden="true" /></summary>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          {roomId !== "all" ? <input type="hidden" name="roomId" value={roomId} /> : null}
          <input type="hidden" name="adjustment" value={adjustment} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="rule-name">Name</FieldLabel>
              <Input id="rule-name" name="name" placeholder="Ramadan" maxLength={80} required />
            </Field>
            <Field>
              <FieldLabel>Room type</FieldLabel>
              <Select value={roomId} onValueChange={(v) => setRoomId(String(v ?? "all"))}>
                <SelectTrigger className="w-full" aria-label="Room type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All room types</SelectItem>
                  {roomTypes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-start">From</FieldLabel>
              <Input id="rule-start" name="dateStart" type="date" min={today} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-end">To</FieldLabel>
              <Input id="rule-end" name="dateEnd" type="date" min={today} required />
            </Field>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Days</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((label, i) => {
                const on = days.includes(i);
                return (
                  <label
                    key={label}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 max-sm:h-10",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={i}
                      checked={on}
                      onChange={() => setDays((cur) => (on ? cur.filter((d) => d !== i) : [...cur, i]))}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-3">
            <Field>
              <FieldLabel>Change</FieldLabel>
              <Select value={adjustment} onValueChange={(v) => setAdjustment(v === "fixed" ? "fixed" : "percent")}>
                <SelectTrigger className="w-44" aria-label="Change">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent of base</SelectItem>
                  <SelectItem value="fixed">Fixed nightly price</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-value">{adjustment === "percent" ? "Percent (+/-)" : "Price"}</FieldLabel>
              <Input
                id="rule-value"
                name="value"
                type="number"
                step="0.01"
                required
                className="w-36 tabular-nums"
                aria-invalid={Boolean(state?.error)}
              />
            </Field>
            <SubmitButton className="sm:ml-auto" pendingText="Adding…">
              <Plus aria-hidden="true" /> Add rule
            </SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}
