"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export function ManagerPermissionControls({
  action,
  propertyField,
  propertyId,
  managerId,
  grantedPermissions,
  permissions,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  propertyField: "hotelId" | "venueId";
  propertyId: string;
  managerId: string;
  grantedPermissions: string[];
  permissions: readonly { key: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="space-y-2">
      <fieldset disabled={pending} aria-busy={pending} className="space-y-2">
        <legend className="text-sm font-medium">Permissions</legend>
        <div className="flex flex-wrap gap-2">
          {permissions.map((permission) => {
            const granted = grantedPermissions.includes(permission.key);
            const next = granted
              ? grantedPermissions.filter((key) => key !== permission.key)
              : [...grantedPermissions, permission.key];

            return (
              <form key={permission.key} action={formAction}>
                <input type="hidden" name={propertyField} value={propertyId} />
                <input type="hidden" name="managerId" value={managerId} />
                {next.map((key) => <input key={key} type="hidden" name="permissions" value={key} />)}
                <button
                  type="submit"
                  aria-pressed={granted}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60 max-sm:h-9",
                    granted
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {permission.label}
                </button>
              </form>
            );
          })}
        </div>
      </fieldset>
      {state?.error ? <div role="alert" className="text-xs text-destructive">{state.error}</div> : null}
    </div>
  );
}
