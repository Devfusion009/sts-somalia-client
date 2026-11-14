"use client";

import { useActionState } from "react";
import type { ActionState } from "@/modules/visa/admin-actions";

/** Re-open the case from persisted data after a lifecycle mutation completes. */
export function useCaseActionState(action: (previous: ActionState, data: FormData) => Promise<ActionState>, initial: null) {
  return useActionState(async (previous: ActionState, data: FormData): Promise<ActionState> => {
    try {
      const result = await action(previous, data);
      if (result && !result.error) window.location.reload();
      return result;
    } catch {
      return { error: "The case could not be updated. Refresh to check its status before retrying." };
    }
  }, initial);
}
