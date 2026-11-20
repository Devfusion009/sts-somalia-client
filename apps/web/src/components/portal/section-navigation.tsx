"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { PortalNavGroup, PortalNavItem, PORTAL_ICONS } from "./portal-shell";
import { filterNavigationGroups } from "./navigation-search";
import styles from "./section-navigation.module.css";

/** A compact service menu: persistent daily links, with one section expanded. */
export function SectionNavigation({ navGroups, activeHref, pathname, query, onNavigate, icons }: {
  navGroups: PortalNavGroup[];
  activeHref?: string;
  pathname: string;
  query: string;
  onNavigate: () => void;
  icons: typeof PORTAL_ICONS;
}) {
  const id = useId();
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const iconOnly = state === "collapsed" && !isMobile;
  const activeGroup = navGroups.find((group) => group.items.some((item) => item.href === activeHref));
  const [selection, setSelection] = useState<{ pathname: string; label: string | null } | null>(null);
  // URL changes reopen their own section; browsing another section never changes the page.
  const openLabel = selection?.pathname === pathname ? selection.label : activeGroup?.label;
  const searching = !iconOnly && query.trim().length > 0;
  const visibleGroups = filterNavigationGroups(navGroups, searching ? query : "");

  function renderItem(item: PortalNavItem, nested = false) {
    const Icon = icons[item.icon];
    return <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        className={`${styles.item} ${nested ? styles.child : ""}`}
        isActive={item.href === activeHref}
        aria-current={item.href === activeHref ? "page" : undefined}
        aria-label={item.label}
        tooltip={item.label}
        render={<Link href={item.href} onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          onNavigate();
          setSelection(null);
          setOpenMobile(false);
        }} />}
      >
        {!nested && <Icon aria-hidden="true" />}
        <span className={styles.label}>{item.label}</span>
        {(item.badge ?? 0) > 0 && <span className={styles.badge} aria-label={`${item.badge} notifications`}>
          {item.badge! > 99 ? "99+" : item.badge}
        </span>}
      </SidebarMenuButton>
    </SidebarMenuItem>;
  }

  return <nav aria-label="Admin navigation" className={styles.navigation} data-icon-only={iconOnly}>
    {visibleGroups.length === 0 && <div role="status" className={styles.empty}>No pages found.</div>}
    {visibleGroups.map((group) => {
      if (group.alwaysOpen) return <div key={group.label} className={styles.primary}>
        <SidebarMenu aria-label={group.label}>{group.items.map((item) => renderItem(item))}</SidebarMenu>
      </div>;
      const Icon = icons[group.icon ?? group.items[0].icon];
      const expanded = !iconOnly && (searching || openLabel === group.label);
      const selected = activeGroup?.label === group.label;
      const pending = group.items.some((item) => (item.badge ?? 0) > 0);
      const sectionId = `${id}-${navGroups.findIndex((entry) => entry.label === group.label)}`;
      return <div key={group.label} className={styles.section} data-navigation-section data-administration={group.label === "Administration"}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              className={`${styles.item} ${styles.sectionButton}`}
              data-current-section={selected}
              tooltip={group.label}
              aria-label={group.label}
              aria-expanded={expanded}
              aria-controls={sectionId}
              onClick={(event) => {
                if (searching) onNavigate();
                setSelection({ pathname, label: expanded && !searching ? null : group.label });
                if (iconOnly) setOpen(true);
                if (!expanded || searching) {
                  const section = event.currentTarget.closest<HTMLElement>("[data-navigation-section]");
                  if (section) requestAnimationFrame(() => section.scrollIntoView({ block: "nearest" }));
                }
              }}
            >
              <Icon aria-hidden="true" />
              <span className={styles.label}>{group.label}</span>
              {pending && !expanded && <span className={styles.pending} role="img" aria-label="Notifications in this section" />}
              <ChevronDown aria-hidden="true" className={styles.chevron} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div id={sectionId} hidden={!expanded} className={styles.children}>
          <SidebarMenu aria-label={group.label}>{group.items.map((item) => renderItem(item, true))}</SidebarMenu>
        </div>
      </div>;
    })}
  </nav>;
}
