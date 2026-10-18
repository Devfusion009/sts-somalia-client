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

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data?: unknown;
  created_at: string;
};

/**
 * Where a notification's title should take the admin. Everything else stays
 * plain text — a link that lands on a list the admin then has to search is
 * worse than no link.
 */
function targetHref(n: NotificationRow): string | null {
  if (n.type === "new_order") return "/admin/queue";
  if (n.type === "payout_request") return "/admin/finance/withdrawals?status=pending";
  if (n.type === "visa_application_submitted" || n.type === "visa_status_changed" || n.type === "visa_case_attention") {
    const applicationId = (n.data as { applicationId?: string } | null)?.applicationId;
    if (applicationId) return `/admin/visa/${applicationId}`;
  }
  if (n.type === "markup_request" || n.type === "wallet_booking_payment") {
    const data = n.data as { agencyId?: string } | null;
    if (data?.agencyId) return `/admin/agencies/${data.agencyId}`;
  }
  if (n.type === "application_document_resubmitted" || n.type === "application_submitted" || n.type === "application_updated") {
    const data = n.data as { applicationType?: string; applicationId?: string } | null;
    if (data?.applicationType && data?.applicationId) {
      return `/admin/applications/${data.applicationType.replace("_", "-")}/${data.applicationId}`;
    }
  }
  return null;
}

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
 * - When a notification arrives, the bell rings with a red pulse and a
 *   chime plays (useBellAlert), then it stays still. While an unread
 *   `new_order` exists the bell stays red: the manual-booking queue is a
 *   promise to the customer that someone is watching.
 * - Light polling: router.refresh() every 30s while the tab is visible.
 *   Notifications are still server-fetched in the layout (no client data
 *   path, no Realtime — neither exists in this codebase); refresh() just
 *   re-runs that fetch, so an order placed mid-session surfaces within the
 *   poll window instead of waiting for the admin's next navigation.
 * - A toast on arrival, not just the badge count: an admin already sitting
 *   on another page (or with the popover closed) had no way to notice a new
 *   row short of the badge number changing in their peripheral vision. Fired
 *   from a diff against the previously seen ids, so it only fires for rows
 *   that appeared since the last render — never for the batch already unread
 *   on first mount.
 */
export function AdminNotificationBell({ notifications }: { notifications: NotificationRow[] }) {
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

  const orderAlert = notifications.some((n) => n.type === "new_order");

  const bellRef = useBellAlert(notifications.map((n) => n.id));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            ref={bellRef}
            className={cn("relative rounded-full", orderAlert && "text-destructive")}
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
                  {targetHref(n) ? (
                    <Link
                      href={targetHref(n)!}
                      className={cn(
                        "truncate text-sm font-medium hover:underline",
                        n.type === "new_order" ? "text-destructive" : "text-primary"
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
