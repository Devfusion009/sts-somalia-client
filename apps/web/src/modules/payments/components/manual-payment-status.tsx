"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Pick up staff approval without requiring the customer to reload checkout. */
export function ManualPaymentStatus() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
