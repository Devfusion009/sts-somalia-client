"use client";

import { useActionState, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { deleteRefundRule, saveRefundRule, type RefundActionState } from "@/modules/hotels/refund-actions";
import type { RefundRule } from "@/modules/hotels/refund-queries";

type SaveAction = (prev: RefundActionState, formData: FormData) => Promise<RefundActionState>;

/**
 * Refund rules for one property. Hotels use the defaults; venues pass their
 * own actions and `scopeName="venueId"`.
 */
export function RefundRulesEditor({
  scopeId,
  scopeName = "hotelId",
  rules,
  canEdit,
  saveAction = saveRefundRule,
  deleteAction = deleteRefundRule,
  anchor = "check-in",
}: {
  scopeId: string;
  scopeName?: "hotelId" | "venueId";
  rules: RefundRule[];
  canEdit: boolean;
  saveAction?: SaveAction;
  deleteAction?: (formData: FormData) => Promise<void>;
  anchor?: "check-in" | "the event";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<RefundActionState, FormData>(async (prev, formData) => {
    const result = await saveAction(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success("Rule saved.", { position: "top-center" });
      formRef.current?.reset();
    }
    return result;
  }, null);

  const lowest = rules.length > 0 ? rules[rules.length - 1].daysBefore : null;

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rules</p>
      ) : (
        <ul className="divide-y divide-border">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0">
              <span>
                {rule.daysBefore === 0 ? "Any time" : `${rule.daysBefore} days or more`} before {anchor}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{rule.deductionPercent}% deducted</span>
                {canEdit ? (
                  <form action={deleteAction}>
                    <input type="hidden" name={scopeName} value={scopeId} />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete rule"
                    >
                      <Trash2 />
                    </Button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
          {lowest !== null && lowest > 0 ? (
            <li className="flex items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground">
              <span>Less than {lowest} days before {anchor}</span>
              <span className="font-semibold tabular-nums">100% deducted</span>
            </li>
          ) : null}
        </ul>
      )}

      {canEdit ? (
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <input type="hidden" name={scopeName} value={scopeId} />
          <Field>
            <FieldLabel htmlFor="daysBefore">Days before {anchor}</FieldLabel>
            <Input id="daysBefore" name="daysBefore" type="number" min={0} max={730} step={1} required className="w-40 tabular-nums" />
          </Field>
          <Field>
            <FieldLabel htmlFor="deductionPercent">Deduction %</FieldLabel>
            <Input
              id="deductionPercent"
              name="deductionPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              className="w-32 tabular-nums"
              aria-invalid={Boolean(state?.error)}
            />
          </Field>
          <SubmitButton className="sm:ml-auto" pendingText="Saving…">
            <Plus aria-hidden="true" /> Add rule
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
