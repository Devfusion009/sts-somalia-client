"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Hotel, Landmark, PartyPopper, Plane, Stamp } from "lucide-react";
import { stripPortalPrefix } from "@/lib/subdomain";
import { AGENT_SERVICES, agentServiceStartHref } from "@/modules/agencies/services";
import styles from "../workspace.module.css";

const ICONS = { flights: Plane, hotels: Hotel, visa: Stamp, umrah: Landmark, events: PartyPopper };

export function ServiceTabs({ hasCustomer }: { hasCustomer: boolean }) {
  const pathname = stripPortalPrefix(usePathname()) ?? "/";
  const serviceKey = useSearchParams().get("service");
  return (
    <nav aria-label="Travel services" className={styles.serviceTabs}>
      {AGENT_SERVICES.map((service) => {
        const Icon = ICONS[service.key];
        const route = stripPortalPrefix(service.href)!;
        const active = pathname === route || pathname.startsWith(`${route}/`) || (pathname === "/book" && serviceKey === service.key);
        return (
          <Link key={service.key} href={hasCustomer ? service.href : agentServiceStartHref(service.key)} aria-current={active ? "page" : undefined} className={styles.serviceTab}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />{service.label}
          </Link>
        );
      })}
    </nav>
  );
}
