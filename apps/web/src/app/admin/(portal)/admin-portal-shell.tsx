"use client";

import type { ComponentProps } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { trpc } from "@/lib/trpc/react";
import { getAdminNavGroups } from "./navigation";

export function AdminPortalShell(props: ComponentProps<typeof PortalShell>) {
  const nav = trpc.notifications.adminNavCounts.useQuery(undefined, { staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false, retry: false });
  const { data } = trpc.notifications.unreadOrderCount.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const initialOrderBadge = props.navGroups.flatMap(group => group.items).find(item => item.href === "/admin/orders")?.badge;
  const navGroups = (nav.data ? getAdminNavGroups(nav.data) : props.navGroups).map(group => ({
    ...group,
    items: group.items.map(item => item.href === "/admin/orders"
      ? { ...item, badge: data ? data.count || undefined : initialOrderBadge }
      : item),
  }));
  return <PortalShell {...props} navGroups={navGroups} />;
}
