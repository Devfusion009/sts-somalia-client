"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleUserStatus } from "@/modules/admin/actions";
import type { Database } from "@/lib/types/database.types";

type AccountStatus = Database["public"]["Enums"]["account_status"];

export function UserStatusToggle({ userId, status }: { userId: string; status: AccountStatus }) {
  const [state, formAction, isPending] = useActionState(toggleUserStatus, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const nextStatus: AccountStatus = status === "suspended" ? "active" : "suspended";

  return (
    <form
      action={() => {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("newStatus", nextStatus);
        formAction(formData);
      }}
    >
      <Button size="sm" variant={status === "suspended" ? "outline" : "destructive"} loading={isPending} type="submit">
        {status === "suspended" ? "Reactivate" : "Suspend"}
      </Button>
    </form>
  );
}
