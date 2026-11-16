"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import type { ActionState } from "@/modules/visa/admin-actions";

/** Re-open the case from persisted data after a lifecycle mutation completes. */
export function useCaseActionState(action: (previous: ActionState, data: FormData) => Promise<ActionState>, initial: null) {
  const router = useRouter();
  const utils = trpc.useUtils();
  return useActionState(async (previous: ActionState, data: FormData): Promise<ActionState> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        action(previous, data),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Action timed out")), 30000); }),
      ]);
      if (result && !result.error) { void utils.notifications.adminNavCounts.invalidate(); router.refresh(); }
      return result;
    } catch {
      return { error: "Update status is unknown. Refresh to check before retrying.", requiresRefresh: true };
    } finally { clearTimeout(timer); }
  }, initial);
}
