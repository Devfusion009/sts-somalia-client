"use client";

import { Megaphone, X } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Surfaces unread `broadcast` notifications (admin → all-agencies push, see
 * apps/api's modules/notifications/notifications.service.ts::sendBroadcast)
 * at the top of the agent dashboard. Same client-side read+dismiss pattern
 * as low-balance-banner.tsx, and the same reasoning for why — see that
 * file's comment.
 */
export function BroadcastBanner() {
  const utils = trpc.useUtils();
  const { data: notifications } = trpc.notifications.unread.useQuery({ type: "broadcast", limit: 3 });
  const dismiss = trpc.notifications.dismiss.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Alert key={n.id} className="relative border-primary/30 bg-primary/5 pr-10">
          <Megaphone className="text-primary" />
          <AlertTitle>{n.title}</AlertTitle>
          {n.body ? <AlertDescription>{n.body}</AlertDescription> : null}
          <button
            type="button"
            onClick={() => dismiss.mutate({ notificationId: n.id })}
            aria-label="Dismiss"
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ))}
    </div>
  );
}
