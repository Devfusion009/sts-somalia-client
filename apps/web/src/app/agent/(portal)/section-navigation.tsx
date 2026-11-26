"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENT_NAV_GROUPS } from "./navigation";
import styles from "@/components/portal/agent-typography.module.css";

export function AgentSectionNavigation() {
  const pathname = usePathname();
  const group = AGENT_NAV_GROUPS.find((item) => !item.alwaysOpen && item.items.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)));
  if (!group) return null;
  // A more specific entry wins over the wallet's /agent/finance prefix.
  const active = [...group.items].sort((a, b) => b.href.length - a.href.length).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return (
    <nav className={styles.sectionNavigation} aria-label={`${group.label} pages`}>
      {group.items.map((item) => <Link key={item.href} href={item.href} aria-current={active?.href === item.href ? "page" : undefined}>{item.label}</Link>)}
    </nav>
  );
}
