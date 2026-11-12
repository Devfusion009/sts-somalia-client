import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { AGENT_SERVICES, agentServiceStartHref } from "@/modules/agencies/services";
import { SERVICE_STYLE } from "./service-palette";
import styles from "./workspace.module.css";

const ITEM_TYPE = { flights: "flight", hotels: "hotel", visa: "visa", umrah: "umrah", events: "hall" } as const;

export function ServiceLauncher({ hasCustomer = false, desk = false }: { hasCustomer?: boolean; desk?: boolean }) {
  return (
    <nav aria-label="Book travel services" className={desk ? `${styles.serviceGrid} ${styles.deskServices}` : styles.serviceGrid}>
      {AGENT_SERVICES.map((service) => {
        const { icon: Icon, color } = SERVICE_STYLE[ITEM_TYPE[service.key]];
        return (
          <Link key={service.key} href={hasCustomer ? service.href : agentServiceStartHref(service.key)} className={styles.service} style={{ "--svc": color } as CSSProperties}>
            <span className={styles.serviceIcon}><Icon aria-hidden="true" /></span>
            <span className={styles.serviceName}>{service.label}</span>
            <span className={styles.serviceAction}>{desk ? "Select service" : service.action}<ArrowRight aria-hidden="true" /></span>
          </Link>
        );
      })}
    </nav>
  );
}
