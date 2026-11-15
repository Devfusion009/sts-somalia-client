"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recoveredDraft } from "../draft-recovery";

/** Tab-scoped, expiring recovery of unsaved fields; never stores files or credentials. */
export function useDraftRecovery(applicationId: string, step: number, revision: string, saved: boolean, onRestore?: (values: Record<string, string>) => void) {
  const storageKey = `sts:visa-draft:${applicationId}:${step}`;
  const formRef = useRef<HTMLFormElement>(null);
  const restore = useRef(onRestore);
  const [recovered, setRecovered] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState(0);
  const completed = useRef(saved);
  useEffect(() => { restore.current = onRestore; completed.current = saved; }, [onRestore, saved]);
  useEffect(() => {
    let frame = 0;
    try {
      const raw = sessionStorage.getItem(storageKey);
      const values = recoveredDraft(raw, revision);
      if (values) {
        frame = requestAnimationFrame(() => { setRecovered(values); setGeneration(1); restore.current?.(values); });
      } else if (raw) sessionStorage.removeItem(storageKey);
    } catch { /* Storage is optional; saving the application remains available. */ }
    return () => cancelAnimationFrame(frame);
  }, [storageKey, revision]);
  const capture = useCallback(() => {
    if (!formRef.current || completed.current) return;
    const form = formRef.current;
    const data = new FormData(form);
    const values: Record<string, string> = {};
    for (const name of new Set(data.keys())) {
      if (["applicationId", "desk", "expectedUpdatedAt"].includes(name) || /password|token|secret/i.test(name)) continue;
      const entries = data.getAll(name).filter((value): value is string => typeof value === "string");
      const multiple = form.querySelectorAll(`[name="${CSS.escape(name)}"]`).length > 1;
      if (entries.length) values[name] = multiple ? JSON.stringify(entries) : entries[0];
    }
    try { sessionStorage.setItem(storageKey, JSON.stringify({ revision, at: Date.now(), values })); } catch { /* Private browsing or full storage. */ }
  }, [revision, storageKey]);
  useEffect(() => {
    window.addEventListener("pagehide", capture);
    return () => window.removeEventListener("pagehide", capture);
  }, [capture]);
  useEffect(() => {
    if (saved) { try { sessionStorage.removeItem(storageKey); } catch {} }
  }, [saved, storageKey]);
  return { formRef, recovered, generation, capture };
}
