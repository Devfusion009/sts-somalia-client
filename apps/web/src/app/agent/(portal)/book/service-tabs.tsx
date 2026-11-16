"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, PartyPopper, Plane, Stamp } from "lucide-react";
import { UmrahIcon } from "@/components/portal/umrah-icon";
import { stripPortalPrefix } from "@/lib/subdomain";
import { AGENT_SERVICES, agentServiceStartHref } from "@/modules/agencies/services";

const ICONS = { flights: Plane, hotels: BedDouble, visa: Stamp, umrah: UmrahIcon, events: PartyPopper };

export function ServiceTabs({ hasCustomer }: { hasCustomer: boolean }) {
  const pathname = stripPortalPrefix(usePathname()) ?? "/";
  if (pathname === "/book") return null;
  const selected = AGENT_SERVICES.find((service) => {
    const route = stripPortalPrefix(service.href)!;
    return pathname === route || pathname.startsWith(`${route}/`);
  });
  if (!selected) return null;
  const Icon = ICONS[selected.key];
  return (
    <nav aria-label="Selected service" className="flex items-center justify-between gap-4 text-sm">
      <Link href={hasCustomer ? selected.href : agentServiceStartHref(selected.key)} aria-current="page" className="inline-flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" aria-hidden="true" />{selected.label}</Link>
      <Link href="/agent/book" className="text-muted-foreground hover:text-foreground">Change service</Link>
    </nav>
  );
}
