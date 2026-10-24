import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Ticket, Wallet, HandCoins, History } from "lucide-react";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AgencyActivityItem } from "@/modules/agencies/queries";

const KIND_ICON: Record<AgencyActivityItem["kind"], typeof Ticket> = {
  booking: Ticket,
  wallet: Wallet,
  payout: HandCoins,
};

export function RecentActivityCard({ items }: { items: AgencyActivityItem[] }) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-3">
        <CardTitle>Recent activity</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/agent/bookings" />}>
            All bookings
          </Button>
        </CardAction>
      </CardHeader>
      {items.length === 0 ? (
        <Empty className="border-t border-border">
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>No activity</EmptyTitle>
        </Empty>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const negative = item.amount < 0;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right text-sm font-semibold tabular-nums", negative && "text-destructive")}>
                    {negative ? "−" : ""}
                    {money(Math.abs(item.amount), item.currency)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
