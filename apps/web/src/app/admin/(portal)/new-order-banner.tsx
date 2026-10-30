"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, ChevronDown, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

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
 * Unread new-order alerts pinned above every admin page as one collapsed bar
 * with the count; expanding it lists the newest few. Opening or dismissing an
 * alert marks it read.
 */
export function NewOrderBanner({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dismiss = trpc.notifications.dismiss.useMutation({ onSuccess: () => router.refresh() });

  const orders = notifications.filter((n) => n.type === "new_order");
  if (orders.length === 0) return null;
  const shown = orders.slice(0, MAX_SHOWN);

  return (
    <section aria-label="New orders" className="mb-6 rounded-xl bg-primary/5 ring-1 ring-primary/25">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <ShoppingBag className="size-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 truncate font-medium tabular-nums">
          {orders.length} new {orders.length === 1 ? "order" : "orders"}
        </p>
        <Button size="sm" variant="ghost" render={<Link href="/admin/orders" />}>
          View all <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls="new-order-list"
          aria-label={open ? "Hide new orders" : "Show new orders"}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </Button>
      </div>

      {open ? (
        <ul id="new-order-list" className="divide-y divide-primary/15 border-t border-primary/15">
          {shown.map((n) => {
            const href = newOrderHref(n);
            return (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
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
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
