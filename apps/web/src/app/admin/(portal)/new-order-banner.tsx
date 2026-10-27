"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data?: unknown;
  created_at: string;
};

const MAX_SHOWN = 3;

/** Where a new-order alert opens: the Orders page, scrolled to that order. */
export function newOrderHref(n: { data?: unknown }): string | null {
  const orderId = (n.data as { order_id?: string } | null)?.order_id;
  return orderId ? `/admin/orders?order=${orderId}#order-${orderId}` : null;
}

/**
 * Unread new-order alerts pinned above every admin page, newest first, so an
 * order placed while staff work elsewhere is seen without opening the bell.
 * Opening or dismissing one marks it read.
 */
export function NewOrderBanner({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const dismiss = trpc.notifications.dismiss.useMutation({ onSuccess: () => router.refresh() });

  const orders = notifications.filter((n) => n.type === "new_order");
  if (orders.length === 0) return null;
  const shown = orders.slice(0, MAX_SHOWN);

  return (
    <section aria-label="New orders" className="mb-6 space-y-2">
      {shown.map((n) => {
        const href = newOrderHref(n);
        return (
          <div
            key={n.id}
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/5 px-4 py-3 ring-1 ring-primary/25"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <ShoppingBag className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{n.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {n.body ? `${n.body} · ` : ""}
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </p>
            </div>
            {href ? (
              <Button
                size="sm"
                render={<Link href={href} onClick={() => dismiss.mutate({ notificationId: n.id })} />}
              >
                View order <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Dismiss ${n.title}`}
              disabled={dismiss.isPending && dismiss.variables?.notificationId === n.id}
              onClick={() => dismiss.mutate({ notificationId: n.id })}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      {orders.length > MAX_SHOWN ? (
        <p className="px-1 text-sm text-muted-foreground tabular-nums">
          {orders.length - MAX_SHOWN} more in{" "}
          <Link href="/admin/orders" className="font-medium text-primary hover:underline">
            Orders &amp; Payments
          </Link>
        </p>
      ) : null}
    </section>
  );
}
