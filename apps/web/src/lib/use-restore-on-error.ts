"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps typed values on screen when a Server Action rejects a form.
 *
 * React 19 resets uncontrolled fields to their `defaultValue` once a form
 * action settles. On success that is invisible — the page navigates away. On a
 * validation error the same form stays mounted, so every field the customer
 * typed snaps back to whatever the server rendered originally: usually blank.
 *
 * This snapshots the form on submit and replays the snapshot after the error
 * arrives, which is after React's own reset has run, so it always gets the
 * last word. Checkboxes, radios and file inputs are skipped — they are either
 * React-controlled here or cannot be restored by assigning `.value`.
 *
 * Lifted out of modules/partner-applications/components/steps.tsx, where this
 * bug was first found and fixed; any long multi-field wizard step needs it.
 */
export function useRestoreOnError(
  formRef: React.RefObject<HTMLFormElement | null>,
  state: { error: string | null } | null
) {
  const snapshotRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const capture = () => {
      snapshotRef.current = Object.fromEntries(
        Array.from(new FormData(form).entries(), ([k, v]) => [k, String(v)])
      );
    };
    form.addEventListener("submit", capture);
    return () => form.removeEventListener("submit", capture);
  }, [formRef]);

  useEffect(() => {
    const snapshot = snapshotRef.current;
    const form = formRef.current;
    if (!state?.error || !snapshot || !form) return;
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) continue;
      if (el.type === "checkbox" || el.type === "radio" || el.type === "file") continue;
      if (!el.name || !(el.name in snapshot)) continue;
      el.value = snapshot[el.name];
    }
  }, [state, formRef]);
}
