"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./hotel-workspace.module.css";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/submit-button";
import {
  addRatePlan,
  deleteRatePlan,
  setRatePlanActive,
  type PlanActionState,
} from "@/modules/hotels/rate-plan-actions";
import { BOARD_LABEL, BOARD_OPTIONS, type BoardBasis, type RatePlan } from "@/modules/hotels/booking-options";

function describeCancellation(plan: RatePlan) {
  if (plan.cancellation === "non_refundable") return "Non-refundable";
  const days = plan.freeCancelDays ?? 0;
  return days === 0 ? "Free cancellation until check-in day" : `Free cancellation until ${days} day${days === 1 ? "" : "s"} before`;
}

export function RatePlansEditor({ hotelId, plans, currency }: { hotelId: string; plans: RatePlan[]; currency: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [board, setBoard] = useState<BoardBasis>("room_only");
  const [cancellation, setCancellation] = useState<"flexible" | "non_refundable">("flexible");
  const [state, formAction] = useActionState<PlanActionState, FormData>(async (prev, formData) => {
    const result = await addRatePlan(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success("Rate added.", { position: "top-center" });
      formRef.current?.reset();
      setBoard("room_only");
      setCancellation("flexible");
    }
    return result;
  }, null);

  return (
    <div className="space-y-5">
      {plans.length > 0 ? (
        <ul className="divide-y divide-border">
          {plans.map((plan) => (
            <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {plan.name}
                  {!plan.isActive ? <Badge variant="neutral">Paused</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {BOARD_LABEL[plan.board]}
                  {plan.board !== "room_only"
                    ? ` (${currency} ${plan.boardPriceAdult.toFixed(2)} adult${plan.boardPriceChild > 0 ? `, ${plan.boardPriceChild.toFixed(2)} child` : ""} / night)`
                    : ""}
                  {" · "}
                  {describeCancellation(plan)}
                  {plan.discountPercent > 0 ? ` · −${plan.discountPercent}%` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <form action={setRatePlanActive}>
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <input type="hidden" name="id" value={plan.id} />
                  <input type="hidden" name="active" value={plan.isActive ? "false" : "true"} />
                  <Button type="submit" variant="outline" size="sm">
                    {plan.isActive ? "Pause" : "Activate"}
                  </Button>
                </form>
                <form action={deleteRatePlan}>
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <input type="hidden" name="id" value={plan.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${plan.name}`}
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
        <summary>Create rate plan<Plus aria-hidden="true" /></summary>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="plan-name">Name</FieldLabel>
              <Input id="plan-name" name="name" placeholder="Flexible rate" maxLength={60} required aria-invalid={Boolean(state?.error)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-board">Meal plan</FieldLabel>
              <select
                id="plan-board"
                name="board"
                value={board}
                onChange={(e) => setBoard(e.target.value as BoardBasis)}
                className={NATIVE_SELECT_CLASS}
              >
                {BOARD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {BOARD_LABEL[option]}
                  </option>
                ))}
              </select>
            </Field>
            {board !== "room_only" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="plan-adult">Meals per adult / night ({currency})</FieldLabel>
                  <Input id="plan-adult" name="boardPriceAdult" type="number" min={0} step="0.01" defaultValue="0" className="tabular-nums" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-child">Meals per child / night ({currency})</FieldLabel>
                  <Input id="plan-child" name="boardPriceChild" type="number" min={0} step="0.01" defaultValue="0" className="tabular-nums" />
                </Field>
              </>
            ) : null}
            <Field>
              <FieldLabel htmlFor="plan-cancellation">Cancellation</FieldLabel>
              <select
                id="plan-cancellation"
                name="cancellation"
                value={cancellation}
                onChange={(e) => setCancellation(e.target.value === "non_refundable" ? "non_refundable" : "flexible")}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="flexible">Free cancellation</option>
                <option value="non_refundable">Non-refundable</option>
              </select>
            </Field>
            {cancellation === "flexible" ? (
              <Field>
                <FieldLabel htmlFor="plan-days">Free until (days before check-in)</FieldLabel>
                <Input id="plan-days" name="freeCancelDays" type="number" min={0} max={60} defaultValue="2" required className="tabular-nums" />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="plan-discount">Discount on room price (%)</FieldLabel>
              <Input id="plan-discount" name="discountPercent" type="number" min={0} max={90} step="0.5" defaultValue="0" className="tabular-nums" />
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingText="Adding…">
              <Plus aria-hidden="true" /> Add rate
            </SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}
