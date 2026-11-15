"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Refresh persisted case facts without resetting scroll, forms or open review dialogs. */
export function CaseLiveSync({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (pending || document.visibilityState !== "visible" || document.querySelector('[role="dialog"], [role="alertdialog"], [aria-busy="true"]') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
      start(() => router.refresh());
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [enabled, pending, router]);
  return null;
}
