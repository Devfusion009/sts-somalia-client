"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { useBellAlert } from "@/components/portal/use-bell-alert";
import { ACTIONABLE_TYPES } from "@/lib/notifications/actionable-types";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data?: unknown;
  created_at: string;
};

function targetHref(n: NotificationRow): string | null {
  if (ACTIONABLE_TYPES.has(n.type)) return "/account/become";
  if (
    n.type === "booking_waitlisted" ||
    n.type === "booking_confirmed" ||
    n.type === "booking_declined" ||
    n.type.startsWith("booking_request_")
  ) {
    const orderId = (n.data as { order_id?: string } | null)?.order_id;
    return orderId ? `/account/bookings/${orderId}` : "/account/bookings";
  }
  // Every umrah_* notification (stage, cancellation, quote, documents,
  // reminders, travel changes) carries the order it belongs to.
  if (n.type.startsWith("umrah_")) {
    const orderId = (n.data as { orderId?: string } | null)?.orderId;
    return orderId ? `/account/bookings/${orderId}` : "/account/bookings";
  }
  if (n.type === "visa_status_changed") {
    const applicationId = (n.data as { applicationId?: string } | null)?.applicationId;
    return applicationId ? `/account/visa/${applicationId}` : "/account/visa";
  }
  return null;
}

const POLL_MS = 30_000;

// Same pattern as AdminNotificationBell (this codebase's only other
// consumer of the notifications table) — this is the piece that was
// missing: a customer whose partner application needed correction had NO
// way to find out short of manually revisiting /account/become, since real
// email/WhatsApp sending is still a placeholder pending Resend/Twilio
// credentials. This works today regardless of that.
export function CustomerNotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const dismiss = trpc.notifications.dismiss.useMutation({
    onSuccess: () => router.refresh(),
  });

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

  const needsAction = notifications.some((n) => ACTIONABLE_TYPES.has(n.type));

  const bellRef = useBellAlert(notifications.map((n) => n.id));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            ref={bellRef}
            aria-label={notifications.length > 0 ? `Notifications (${notifications.length} unread)` : "Notifications"}
            className={cn("relative rounded-full", needsAction && "text-destructive")}
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
          {needsAction ? (
            <Link href="/account/become" className="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              Open applications
            </Link>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  {targetHref(n) ? (
                    <Link
                      href={targetHref(n)!}
                      className={cn(
                        "block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
                        ACTIONABLE_TYPES.has(n.type) ? "text-destructive" : "text-primary"
                      )}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  )}
                  {n.body ? <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={`Dismiss ${n.title}`}
                  disabled={dismiss.isPending && dismiss.variables?.notificationId === n.id}
                  onClick={() => dismiss.mutate({ notificationId: n.id })}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
