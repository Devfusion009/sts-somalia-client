"use client";

import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Surfaces unread `low_balance` notifications (written by the
 * notify_low_agency_balance DB trigger — see 20260807000001_b2b_phase1.sql)
 * at the top of the agent dashboard.
 *
 * Was a zero-client-JS server component (dismiss posted through a plain
 * form action) — moving the read+dismiss behind apps/api's tRPC procedures
 * means both now need to happen client-side, so this is a real, deliberate
 * tradeoff of this migration phase, not an oversight. The caller always
 * scopes to its own token-derived identity server-side regardless of what
 * this component is told, so no `profileId` prop is needed anymore.
 */
export function LowBalanceBanner() {
  const utils = trpc.useUtils();
  const { data: notifications } = trpc.notifications.unread.useQuery({ type: "low_balance", limit: 3 });
  const dismiss = trpc.notifications.dismiss.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Alert key={n.id} variant="destructive" className="relative pr-10">
          <AlertTriangle />
          <AlertTitle>{n.title}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{n.body}</span>
            <Button size="sm" variant="outline" render={<Link href="/agent/finance" />}>
              Open wallet
            </Button>
          </AlertDescription>
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
