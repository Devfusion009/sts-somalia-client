"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function BookingContextVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "");
  if (pathname === "/agent/book" || pathname === "/book" || pathname.startsWith("/agent/book/order/")) return null;
  return <>{children}</>;
}
