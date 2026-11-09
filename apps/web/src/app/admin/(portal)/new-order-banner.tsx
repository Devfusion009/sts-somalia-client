"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, ChevronDown, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";
import { usePortalNotifications } from "@/components/portal/use-portal-notifications";
import { stripPortalPrefix } from "@/lib/subdomain";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 3;

/** Where a new-order alert opens: the Orders page, scrolled to that order. */
export function newOrderHref(n: { data?: unknown }): string | null {
  const orderId = (n.data as { order_id?: string } | null)?.order_id;
  return orderId ? `/admin/orders?order=${orderId}#order-${orderId}` : null;
}

/**
 * Unread new-order alerts as one collapsed bar on the dashboard; expanding it
 * lists the newest few. Opening the Orders page counts as having seen them all,
 * so the bar and the bell clear instead of resurfacing on the next visit.
 */
export function NewOrderBanner() {
  const { data: notifications = [] } = usePortalNotifications(false);
  const utils = trpc.useUtils();
  // The proxy rewrites admin.<host>/orders to /admin/orders, so both forms are matched.
  const path = stripPortalPrefix(usePathname()) ?? "/";
  const onDashboard = path === "/";
  const onOrders = path === "/orders" || path.startsWith("/orders/");
  const [open, setOpen] = useState(false);
  const dismiss = trpc.notifications.dismiss.useMutation({ onSuccess: () => utils.notifications.unread.invalidate() });
  const dismissAll = trpc.notifications.dismissType.useMutation({ onSuccess: () => utils.notifications.unread.invalidate() });

  const orders = notifications.filter((n) => n.type === "new_order");
  const latestId = orders[0]?.id;
  const markedFor = useRef<string | null>(null);
  const { mutate: markAllSeen } = dismissAll;

  useEffect(() => {
    if (!onOrders || !latestId || markedFor.current === latestId) return;
    markedFor.current = latestId;
    markAllSeen({ type: "new_order" });
  }, [onOrders, latestId, markAllSeen]);

  if (!onDashboard || orders.length === 0) return null;
  const shown = orders.slice(0, MAX_SHOWN);

  return (
    <section aria-label="New orders" className="mb-6 rounded-xl bg-primary/5 ring-1 ring-primary/25">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <ShoppingBag className="size-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 truncate font-medium tabular-nums">
          {orders.length} new {orders.length === 1 ? "order" : "orders"}
        </p>
        <Button size="sm" variant="ghost" render={<Link href="/admin/orders" />}>
          View all <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls="new-order-list"
          aria-label={open ? "Hide new orders" : "Show new orders"}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </Button>
      </div>

      {open ? (
        <ul id="new-order-list" className="divide-y divide-primary/15 border-t border-primary/15">
          {shown.map((n) => {
            const href = newOrderHref(n);
            return (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {n.body ? `${n.body} · ` : ""}
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {href ? (
                  <Button
                    size="sm"
                    render={<Link href={href} onClick={() => dismiss.mutate({ notificationId: n.id })} />}
                  >
                    View order <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Dismiss ${n.title}`}
                  disabled={dismiss.isPending && dismiss.variables?.notificationId === n.id}
                  onClick={() => dismiss.mutate({ notificationId: n.id })}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
