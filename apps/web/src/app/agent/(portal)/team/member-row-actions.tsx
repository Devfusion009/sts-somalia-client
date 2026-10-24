"use client";

import { useActionState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { updateTeamMemberRole, removeTeamMember } from "@/modules/agencies/team-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "booking_staff", label: "Booking Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
] as const;

export function MemberRowActions({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: string;
}) {
  const [roleState, roleAction] = useActionState(updateTeamMemberRole, null);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <form action={roleAction} className="flex items-center gap-1.5">
        <input type="hidden" name="memberId" value={memberId} />
        {roleState?.error ? (
          <span title={roleState.error} role="alert" className="flex items-center">
            <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
            <span className="sr-only">{roleState.error}</span>
          </span>
        ) : null}
        <select
          name="role"
          defaultValue={currentRole}
          aria-label="Role"
          aria-invalid={roleState?.error ? true : undefined}
          className={`${NATIVE_SELECT_CLASS} w-36`}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <SubmitButton variant="outline" pendingText="Saving…">
          Save
        </SubmitButton>
      </form>
      <form action={removeTeamMember}>
        <input type="hidden" name="memberId" value={memberId} />
        <ConfirmButton
          title="Remove this team member?"
          confirmLabel="Remove"
          size="icon"
          variant="ghost"
          aria-label="Remove member"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
        </ConfirmButton>
      </form>
    </div>
  );
}
