"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dismissNotification } from "@/modules/notifications/actions";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
};

const POLL_MS = 30_000;

/**
 * Admin-only notification bell — the first UI surface for the
 * `notifications` table anywhere in the app (previously delivered only as
 * inline dashboard banners on the agent portal; see LowBalanceBanner/
 * BroadcastBanner). Rendered via PortalShell's headerExtra slot, so it's
 * only ever passed from the admin layout — other portals are unaffected.
 *
 * Two alert behaviors layered on the plain bell:
 *
 * - While any unread `new_order` alert exists, the bell rings and a red
 *   pulse radiates from it (emergency-light styling, CSS-only keyframes in
 *   globals.css that prefers-reduced-motion turns off). New orders are the
 *   one notification an admin must act on promptly — the manual-booking
 *   queue is a promise to the customer that someone is watching.
 * - Light polling: router.refresh() every 30s while the tab is visible.
 *   Notifications are still server-fetched in the layout (no client data
 *   path, no Realtime — neither exists in this codebase); refresh() just
 *   re-runs that fetch, so an order placed mid-session surfaces within the
 *   poll window instead of waiting for the admin's next navigation.
 */
export function AdminNotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  const orderAlert = notifications.some((n) => n.type === "new_order");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", orderAlert && "animate-alert-pulse rounded-full text-destructive")}
          >
            <Bell className={cn("size-4", orderAlert && "animate-bell-ring")} />
            {notifications.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {orderAlert ? (
            <Link href="/admin/queue" className="text-xs font-medium text-primary hover:underline">
              Open queue
            </Link>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  {n.type === "new_order" ? (
                    <Link href="/admin/queue" className="truncate text-sm font-medium text-destructive hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  )}
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <form action={dismissNotification}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <input type="hidden" name="path" value={pathname} />
                  <Button type="submit" size="icon" variant="ghost" className="size-6 shrink-0">
                    <X className="size-3.5" />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
