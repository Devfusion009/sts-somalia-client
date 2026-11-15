"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { useBellAlert } from "@/components/portal/use-bell-alert";
import { usePortalNotifications } from "@/components/portal/use-portal-notifications";
import { adminNotificationHref } from "@/lib/notifications/links";

/**
 * Where a notification's title should take the admin. Everything else stays
 * plain text — a link that lands on a list the admin then has to search is
 * worse than no link.
 */
/** Notification reads and dismissals update only the shared client query. */
export function AdminNotificationBell() {
  const { data, isPending, isError } = usePortalNotifications();
  const notifications = data ?? [];
  const utils = trpc.useUtils();
  const router = useRouter();
  const dismiss = trpc.notifications.dismiss.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (seenIds.current) {
      const newlyArrived = data.filter((n) => !seenIds.current!.has(n.id));
      for (const n of newlyArrived) {
        const href = adminNotificationHref(n);
        toast.info(n.title, {
          description: n.body ?? undefined,
          action: href ? { label: "Open", onClick: () => router.push(href) } : undefined,
        });
      }
    }
    seenIds.current = new Set(data.map((n) => n.id));
  }, [data, router]);

  const orderAlert = notifications.some((n) => n.type === "new_order");

  const bellRef = useBellAlert(data?.map((n) => n.id));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            ref={bellRef}
            aria-label={notifications.length > 0 ? `Notifications (${notifications.length} unread)` : "Notifications"}
            className={cn("relative rounded-full", orderAlert && "text-destructive")}
          >
            <Bell className="size-4" aria-hidden="true" />
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
            <Link href="/admin/orders" className="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              All orders
            </Link>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{isPending ? "Loading notifications" : isError ? "Notifications unavailable" : "No notifications"}</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  {adminNotificationHref(n) ? (
                    <Link
                      href={adminNotificationHref(n)!}
                      className={cn(
                        "block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
                        n.type === "new_order" ? "text-destructive" : "text-primary"
                      )}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  )}
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{format(new Date(n.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
                {n.type !== "new_order" ? <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={`Dismiss ${n.title}`}
                  disabled={dismiss.isPending && dismiss.variables?.notificationId === n.id}
                  onClick={() => dismiss.mutate({ notificationId: n.id })}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button> : null}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
