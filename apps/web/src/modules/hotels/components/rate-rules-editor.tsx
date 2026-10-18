"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { addRateRule, deleteRateRule, type RateActionState } from "@/modules/hotels/rate-actions";
import type { RateRule } from "@/modules/hotels/rate-queries";
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
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rules.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rule.roomName ?? "All room types"} · {rule.dateStart} → {rule.dateEnd} · {describeDays(rule.weekdays)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{describeAdjustment(rule)}</span>
                <form action={deleteRateRule}>
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <Button type="submit" variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Delete rule">
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="space-y-4 border-t border-border pt-5">
        <input type="hidden" name="hotelId" value={hotelId} />
        {roomId !== "all" ? <input type="hidden" name="roomId" value={roomId} /> : null}
        <input type="hidden" name="adjustment" value={adjustment} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Name</Label>
            <Input id="rule-name" name="name" placeholder="Ramadan" maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label>Room type</Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(String(v ?? "all"))}>
              <SelectTrigger className="w-full">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-start">From</Label>
            <Input id="rule-start" name="dateStart" type="date" min={today} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-end">To</Label>
            <Input id="rule-end" name="dateEnd" type="date" min={today} required />
          </div>
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
                    "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
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
          <div className="space-y-1.5">
            <Label>Change</Label>
            <Select value={adjustment} onValueChange={(v) => setAdjustment(v === "fixed" ? "fixed" : "percent")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent of base</SelectItem>
                <SelectItem value="fixed">Fixed nightly price</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-value">{adjustment === "percent" ? "Percent (+/-)" : "Price"}</Label>
            <Input
              id="rule-value"
              name="value"
              type="number"
              step="0.01"
              required
              className="w-36"
              aria-invalid={Boolean(state?.error)}
            />
          </div>
          <SubmitButton size="sm" className="gap-1.5" pendingText="Adding…">
            <Plus className="size-3.5" /> Add rule
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
