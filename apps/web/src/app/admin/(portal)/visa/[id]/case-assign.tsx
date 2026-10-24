"use client";

import { useActionState, useRef } from "react";
import { Flag, Hand } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { adminAssignCase, adminClaimCase, adminSetCasePriority } from "@/modules/visa/admin-actions";

type Staff = { id: string; full_name: string | null; email: string | null };

export function CaseAssign({
  applicationId,
  assignedTo,
  meId,
  priority,
  staff,
  canAssign,
}: {
  applicationId: string;
  assignedTo: string | null;
  meId: string;
  priority: string;
  staff: Staff[];
  canAssign: boolean;
}) {
  const [state, assignAction] = useActionState(adminAssignCase, null);
  const formRef = useRef<HTMLFormElement>(null);
  const urgent = priority === "urgent";
  const options = [
    { value: "", label: "Unassigned" },
    ...staff.map((s) => ({ value: s.id, label: s.id === meId ? `${s.full_name ?? s.email} (me)` : (s.full_name ?? s.email ?? "Staff") })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assignedTo !== meId ? (
        <form action={adminClaimCase}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <SubmitButton variant="outline" size="sm" pendingText="Claiming…">
            <Hand data-icon="inline-start" /> Claim
          </SubmitButton>
        </form>
      ) : null}

      {canAssign ? (
        <form ref={formRef} action={assignAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <Select
            name="assignee"
            defaultValue={assignedTo ?? ""}
            items={options}
            onValueChange={() => requestAnimationFrame(() => formRef.current?.requestSubmit())}
          >
            <SelectTrigger size="sm" className="w-full sm:w-48" aria-label="Owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value || "none"} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </form>
      ) : null}

      {canAssign ? (
        <form action={adminSetCasePriority}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="priority" value={urgent ? "normal" : "urgent"} />
          <button
            type="submit"
            aria-pressed={urgent}
            title={urgent ? "Clear urgent" : "Mark urgent"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-10",
              urgent
                ? "border-destructive bg-destructive text-white"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Flag className="size-3" aria-hidden="true" /> Urgent
          </button>
        </form>
      ) : null}
      {state?.error ? (
        <p role="alert" className="basis-full text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
