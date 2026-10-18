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
  if (n.type === "low_balance") return "/agent/finance";
  if (n.type === "earnings_reviewed") return "/agent/finance";
  if (n.type === "payout_request_reviewed" || n.type === "payout_paid") return "/agent/finance/withdrawals";
  if (n.type === "topup_reviewed") return "/agent/finance/top-up";
  if (n.type === "markup_request_reviewed") return "/agent/markups";
  if (n.type === "partner_onboarding_reminder") return "/agent";
  // The agent portal has no per-application visa view yet (that arrives with
  // the desk in M7), so this lands on the filtered agency bookings list.
  if (n.type === "visa_status_changed") return "/agent/bookings?type=visa";
  if (n.type === "umrah_stage_changed") {
    const data = n.data as { orderId?: string } | null;
    return data?.orderId ? `/agent/bookings/${data.orderId}` : "/agent/bookings?type=umrah";
  }
  if (n.type === "wallet_booking_payment") {
    const data = n.data as { orderId?: string } | null;
    return data?.orderId ? `/agent/book/order/${data.orderId}` : "/agent/bookings";
  }
  if (ACTIONABLE_TYPES.has(n.type) || n.type === "application_documents_verified") return "/account/become";
  return null;
}

const POLL_MS = 30_000;

/**
 * Agent-portal counterpart to AdminNotificationBell — same table, same
 * dismiss/poll/toast behavior, different type→link map and alert trigger.
 * A low agency balance is this portal's equivalent of a new order: the one
 * condition that blocks the agent from booking until they act on it.
 */
export function AgentNotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const dismiss = trpc.notifications.dismiss.useMutation({
    onSuccess: () => router.refresh(),
  });
  const seenIds = useRef<Set<string> | null>(null);

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

  useEffect(() => {
    if (seenIds.current) {
      const newlyArrived = notifications.filter((n) => !seenIds.current!.has(n.id));
      for (const n of newlyArrived) {
        const href = targetHref(n);
        toast.info(n.title, {
          description: n.body ?? undefined,
          action: href ? { label: "Open", onClick: () => router.push(href) } : undefined,
        });
      }
    }
    seenIds.current = new Set(notifications.map((n) => n.id));
  }, [notifications, router]);

  const lowBalanceAlert = notifications.some((n) => n.type === "low_balance");
  const actionAlert = lowBalanceAlert || notifications.some((n) => ACTIONABLE_TYPES.has(n.type));

  const bellRef = useBellAlert(notifications.map((n) => n.id));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            ref={bellRef}
            className={cn("relative rounded-full", actionAlert && "text-destructive")}
          >
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
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {lowBalanceAlert ? (
            <Link href="/agent/finance" className="text-xs font-medium text-primary hover:underline">
              Open finance
            </Link>
          ) : actionAlert ? (
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
                        n.type === "low_balance" || ACTIONABLE_TYPES.has(n.type) ? "text-destructive" : "text-primary"
                      )}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  )}
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
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
