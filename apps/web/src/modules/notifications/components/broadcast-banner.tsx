import { Megaphone, X } from "lucide-react";
import { getUnreadNotifications } from "@/modules/notifications/queries";
import { dismissNotification } from "@/modules/notifications/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Surfaces unread `broadcast` notifications (admin → all-agencies push,
 * see src/modules/notifications/broadcast-actions.ts) at the top of the
 * agent dashboard. Same server-only dismiss-via-form pattern as
 * low-balance-banner.tsx — no client JS needed.
 */
export async function BroadcastBanner({ profileId }: { profileId: string }) {
  const notifications = await getUnreadNotifications(profileId, { type: "broadcast", limit: 3 });
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Alert key={n.id} className="relative border-primary/30 bg-primary/5 pr-10">
          <Megaphone className="text-primary" />
          <AlertTitle>{n.title}</AlertTitle>
          {n.body ? <AlertDescription>{n.body}</AlertDescription> : null}
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
