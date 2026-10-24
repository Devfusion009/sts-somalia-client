import type { ReactNode } from "react";
import type { ActionState } from "@/lib/auth/actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export { NATIVE_SELECT_CLASS as selectClass };

/** Result line on the left, the form's actions right-aligned. */
export function FormFooter({ state, children }: { state: ActionState; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
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
