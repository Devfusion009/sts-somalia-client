import Link from "next/link";
import { ArrowRight, Building2, ClipboardCheck, Landmark, PartyPopper, Stamp, Ticket } from "lucide-react";
import { WorkspaceCover } from "@/components/portal/workspace-cover";
import styles from "./workspace.module.css";

const DESKS = [
  { href: "/admin/orders", label: "Orders & payments", icon: Ticket },
  { href: "/admin/visa", label: "Visa applications", icon: Stamp },
  { href: "/admin/umrah/bookings", label: "Umrah bookings", icon: Landmark },
  { href: "/admin/hotels", label: "Hotels", icon: Building2 },
  { href: "/admin/events", label: "Events & halls", icon: PartyPopper },
  { href: "/admin/applications", label: "Partner applications", icon: ClipboardCheck },
];

export function AdminWorkspace() {
  return (
    <section className={styles.workspace} aria-label="Admin workspaces">
      <WorkspaceCover
        compact
        headingLevel={2}
        image="/admin/travel-operations.svg"
        title="Travel operations"
        actions={<Link href="/admin/queue" className={styles.queueLink}>Open order queue<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}
      />
      <nav aria-label="Service workspaces" className={styles.desks}>
        {DESKS.map((desk) => <Link key={desk.href} href={desk.href} className={styles.desk}>
          <desk.icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span>{desk.label}</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>)}
      </nav>
    </section>
  );
}
