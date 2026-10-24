import type { ReactNode } from "react";

/** Result line on the left, the save action right-aligned under a hairline. */
export function SettingsFooter({ state, children }: { state: { error: string | null } | null; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-4">
      {state?.error ? (
        <p role="alert" className="mr-auto text-sm text-destructive">
          {state.error}
        </p>
      ) : state ? (
        <p role="status" className="mr-auto text-sm text-primary">
          Saved.
        </p>
      ) : null}
      {children}
    </div>
  );
}
