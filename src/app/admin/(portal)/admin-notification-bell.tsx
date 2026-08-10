"use client";

import { usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dismissNotification } from "@/modules/notifications/actions";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
};

/**
 * Admin-only notification bell — the first UI surface for the
 * `notifications` table anywhere in the app (previously delivered only as
 * inline dashboard banners on the agent portal; see LowBalanceBanner/
 * BroadcastBanner). Rendered via PortalShell's headerExtra slot, so it's
 * only ever passed from the admin layout — other portals are unaffected.
 *
 * Refreshes on navigation/revalidation like the rest of this app (no
 * polling or Realtime subscription — neither exists anywhere in this
 * codebase yet), so a reminder that fires while the admin is mid-session
 * on one page appears once they navigate, not instantly.
 */
export function AdminNotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const pathname = usePathname();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            {notifications.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.title}</p>
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
