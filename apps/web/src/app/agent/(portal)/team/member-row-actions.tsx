"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { updateTeamMemberRole, removeTeamMember } from "@/modules/agencies/team-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "booking_staff", label: "Booking Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
] as const;

const selectClass =
  "border-input h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function MemberRowActions({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: string;
}) {
  const [roleState, roleAction] = useActionState(updateTeamMemberRole, null);

  return (
    <div className="flex items-center justify-end gap-2">
      <form action={roleAction} className="flex items-center gap-1.5">
        <input type="hidden" name="memberId" value={memberId} />
        {roleState?.error ? (
          <span title={roleState.error}>
            <AlertCircle className="size-3.5 text-destructive" />
          </span>
        ) : null}
        <select name="role" defaultValue={currentRole} className={selectClass}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <SubmitButton size="sm" variant="outline" pendingText="…">
          Save
        </SubmitButton>
      </form>
      <form action={removeTeamMember}>
        <input type="hidden" name="memberId" value={memberId} />
        <ConfirmButton
          title="Remove this team member?"
          confirmLabel="Remove"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
        >
          Remove
        </ConfirmButton>
      </form>
    </div>
  );
}
