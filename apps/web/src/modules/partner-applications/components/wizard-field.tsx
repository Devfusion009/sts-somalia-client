"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "../actions";
import type { FieldErrors } from "../schemas";

type FieldResult = { success: true } | { success: false; error: { issues: Array<{ message: string }> } };
/** Structural stand-in for a Zod object schema: only its per-field `safeParse` is used. */
type StepSchema = { shape: Record<string, { safeParse: (value: unknown) => FieldResult }> };

type FieldErrorsContextValue = {
  errors: FieldErrors;
  /** True once "Continue" has come back with field errors. */
  attempted: boolean;
  check: (name: string, mode: "blur" | "change") => void;
};

const FieldErrorsContext = createContext<FieldErrorsContextValue | null>(null);

export const FieldErrorsProvider = FieldErrorsContext.Provider;

/**
 * Inline, per-field validation for one wizard step.
 *
 * A field is checked against the same schema the server action enforces when
 * the applicant leaves it (if they typed something) and again on every edit
 * once it is flagged, so a fixed field clears immediately. "Continue" replaces
 * the whole map with the server's verdict and moves focus to the first field
 * that still needs attention. Background autosave results never touch it: an
 * applicant halfway through a step has not asked to be told what is missing.
 */
export function useFieldValidation(
  formRef: React.RefObject<HTMLFormElement | null>,
  schema: StepSchema,
  state: ActionState
): FieldErrorsContextValue {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state && !state.autosave) {
      setErrors(state.fieldErrors ?? {});
      setAttempted(Boolean(state.fieldErrors));
    }
  }

  useEffect(() => {
    if (!state || state.autosave || !state.fieldErrors) return;
    const target = formRef.current?.querySelector<HTMLElement>(
      "[data-invalid] input:not([type=hidden]), [data-invalid] textarea, [data-invalid] select, [data-invalid] button"
    );
    target?.focus({ preventScroll: true });
    target?.closest("[data-invalid]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state, formRef]);

  const check = useCallback(
    (name: string, mode: "blur" | "change") => {
      const rule = schema.shape[name];
      if (!rule) return;
      // Read after React commits: composite fields (phone, pickers) write
      // their hidden input from state, which is not updated mid-event.
      requestAnimationFrame(() => {
        const form = formRef.current;
        if (!form) return;
        const value = String(new FormData(form).get(name) ?? "");
        setErrors((prev) => {
          const flagged = name in prev;
          if (mode === "change" && !flagged) return prev;
          if (mode === "blur" && !flagged && value.trim() === "") return prev;
          const result = rule.safeParse(value);
          if (result.success) {
            if (!flagged) return prev;
            const next = { ...prev };
            delete next[name];
            return next;
          }
          const message = result.error.issues[0]?.message ?? "";
          return prev[name] === message ? prev : { ...prev, [name]: message };
        });
      });
    },
    [formRef, schema]
  );

  return useMemo(() => ({ errors, attempted, check }), [errors, attempted, check]);
}

/** Fields still flagged after a "Continue" attempt; 0 before the first attempt. */
export function useFieldErrorCount(): number {
  const ctx = useContext(FieldErrorsContext);
  return ctx?.attempted ? Object.keys(ctx.errors).length : 0;
}

/** Label, control and inline error for one named wizard field. */
export function WizardField({
  name,
  label,
  required,
  htmlFor,
  className,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(FieldErrorsContext);
  const error = ctx?.errors[name];

  return (
    <div
      data-field={name}
      data-invalid={error ? "" : undefined}
      className={cn(
        "space-y-1.5",
        error &&
          "[&_input:not([type=hidden])]:border-destructive [&_input:not([type=hidden])]:ring-3 [&_input:not([type=hidden])]:ring-destructive/15 [&_select]:border-destructive [&_textarea]:border-destructive [&_textarea]:ring-3 [&_textarea]:ring-destructive/15",
        className
      )}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) ctx?.check(name, "blur");
      }}
      onChange={() => ctx?.check(name, "change")}
      onClick={() => ctx?.check(name, "change")}
    >
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
