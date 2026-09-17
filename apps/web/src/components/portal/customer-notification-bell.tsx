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
  if (n.type === "booking_waitlisted") {
    const orderId = (n.data as { order_id?: string } | null)?.order_id;
    return orderId ? `/account/bookings/${orderId}` : "/account/bookings";
  }
  if (n.type === "umrah_stage_changed") {
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

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", needsAction && "animate-alert-pulse rounded-full text-destructive")}
          >
            <Bell className={cn("size-4", needsAction && "animate-bell-ring")} />
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
            <Link href="/account/become" className="text-xs font-medium text-primary hover:underline">
              Open applications
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
                  {targetHref(n) ? (
                    <Link
                      href={targetHref(n)!}
                      className={cn(
                        "truncate text-sm font-medium hover:underline",
                        ACTIONABLE_TYPES.has(n.type) ? "text-destructive" : "text-primary"
                      )}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  )}
                  {n.body ? <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6 shrink-0"
                  onClick={() => dismiss.mutate({ notificationId: n.id })}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
