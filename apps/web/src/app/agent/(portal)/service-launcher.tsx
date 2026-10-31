import Link from "next/link";
import { ArrowRight, Hotel, Landmark, PartyPopper, Plane, Stamp } from "lucide-react";
import { AGENT_SERVICES, agentServiceStartHref } from "@/modules/agencies/services";
import styles from "./workspace.module.css";

const ICONS = { flights: Plane, hotels: Hotel, visa: Stamp, umrah: Landmark, events: PartyPopper };

export function ServiceLauncher({ hasCustomer = false }: { hasCustomer?: boolean }) {
  return (
    <nav aria-label="Book travel services" className={styles.serviceGrid}>
      {AGENT_SERVICES.map((service) => {
        const Icon = ICONS[service.key];
        return (
          <Link key={service.key} href={hasCustomer ? service.href : agentServiceStartHref(service.key)} className={styles.service}>
            <Icon aria-hidden="true" />
            <span>{service.label}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
