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
        <Alert key={n.id} className="relative pr-10">
          <Megaphone />
          <AlertTitle>{n.title}</AlertTitle>
          {n.body ? <AlertDescription>{n.body}</AlertDescription> : null}
          <button
            type="button"
            onClick={() => dismiss.mutate({ notificationId: n.id })}
            aria-label={`Dismiss ${n.title}`}
            disabled={dismiss.isPending && dismiss.variables?.notificationId === n.id}
            className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </Alert>
      ))}
    </div>
  );
}
