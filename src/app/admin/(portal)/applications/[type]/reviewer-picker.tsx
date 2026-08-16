"use client";

import { useActionState } from "react";
import { assignReviewer } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";

export function ReviewerPicker({
  applicationId,
  type,
  currentReviewerId,
  admins,
}: {
  applicationId: string;
  type: ApplicationType;
  currentReviewerId: string | null;
  admins: Array<{ id: string; full_name: string | null; email: string | null }>;
}) {
  const [, formAction] = useActionState(assignReviewer.bind(null, type), null);

  return (
    <form action={formAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <select
        name="reviewerId"
        defaultValue={currentReviewerId ?? "unassigned"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-input h-10 w-full rounded-md border bg-transparent px-3.5 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="unassigned">Unassigned</option>
        {admins.map((admin) => (
          <option key={admin.id} value={admin.id}>
            {admin.full_name ?? admin.email ?? "—"}
          </option>
        ))}
      </select>
    </form>
  );
}
