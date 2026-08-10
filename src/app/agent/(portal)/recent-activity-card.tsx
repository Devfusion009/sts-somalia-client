import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Ticket, Wallet, HandCoins } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgencyActivityItem } from "@/modules/agencies/queries";

const KIND_META: Record<AgencyActivityItem["kind"], { icon: typeof Ticket; tint: string }> = {
  booking: { icon: Ticket, tint: "bg-primary/10 text-primary" },
  wallet: { icon: Wallet, tint: "bg-brand-gold/15 text-brand-gold" },
  payout: { icon: HandCoins, tint: "bg-brand-accent/10 text-brand-accent" },
};

function money(amount: number, currency: string) {
  const sign = amount < 0 ? "−" : "";
  return `${sign}${currency} ${Math.abs(amount).toFixed(0)}`;
}

export function RecentActivityCard({ items }: { items: AgencyActivityItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1 text-primary" render={<Link href="/agent/bookings" />}>
          View all bookings <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing here yet — your bookings, wallet activity, and payouts will show up here.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const meta = KIND_META[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", meta.tint)}>
                        <meta.icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.subtitle} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-semibold", item.amount < 0 && "text-destructive")}>
                      {money(item.amount, item.currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
