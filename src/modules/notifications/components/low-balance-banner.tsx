import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { getUnreadNotifications } from "@/modules/notifications/queries";
import { dismissNotification } from "@/modules/notifications/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Surfaces unread `low_balance` notifications (written by the
 * notify_low_agency_balance DB trigger — see 20260807000001_b2b_phase1.sql)
 * at the top of the agent dashboard. Server component: dismiss posts back
 * through a plain form action, no client JS needed.
 */
export async function LowBalanceBanner({ profileId }: { profileId: string }) {
  const notifications = await getUnreadNotifications(profileId, { type: "low_balance", limit: 3 });
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Alert key={n.id} variant="destructive" className="relative pr-10">
          <AlertTriangle />
          <AlertTitle>{n.title}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{n.body}</span>
            <Button size="sm" variant="outline" className="h-7" render={<Link href="/agent/wallet" />}>
              Go to Wallet
            </Button>
          </AlertDescription>
          <form action={dismissNotification} className="absolute top-3 right-3">
            <input type="hidden" name="notificationId" value={n.id} />
            <input type="hidden" name="path" value="/agent" />
            <button type="submit" aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </form>
        </Alert>
      ))}
    </div>
  );
}
