import { formatDistanceToNow } from "date-fns";
import { BedDouble, PartyPopper, Inbox, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getBookingQueue } from "@/modules/admin/queue-queries";
import { QueueEntryActions, PriceQuoteForm } from "./queue-actions";

export const metadata = { title: "Order Queue | Admin Console" };

/**
 * The manual-booking queue. Somali hotels and event halls have no booking
 * APIs — every request is confirmed by a human. Strict FIFO (oldest first):
 * the customer who ordered first gets handled first, so position in this
 * list IS the promise being kept.
 */
export default async function OrderQueuePage() {
  const queue = await getBookingQueue();
  const waitlisted = queue.filter((q) => q.status === "waitlisted").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-xl font-semibold">Order Queue</h1>
        <Badge variant="secondary">{queue.length} waiting</Badge>
        {waitlisted > 0 ? <Badge variant="outline">{waitlisted} waitlisted</Badge> : null}
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" />
            The queue is clear — every request has been handled.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((entry, i) => (
            <Card key={`${entry.kind}-${entry.id}`} className={entry.status === "waitlisted" ? "border-brand-gold/50" : undefined}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-heading text-lg font-bold text-muted-foreground/60">#{i + 1}</span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {entry.kind === "hotel" ? (
                      <BedDouble className="size-5" />
                    ) : entry.kind === "hall" ? (
                      <PartyPopper className="size-5" />
                    ) : (
                      <Landmark className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {entry.title}
                      {entry.status === "waitlisted" ? (
                        <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Waitlisted — dates full</Badge>
                      ) : (
                        <Badge variant="secondary">New request</Badge>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.customerName ?? entry.customerEmail ?? "Customer"} · placed{" "}
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <div className="text-right">
                    <p className="font-heading text-lg font-semibold">
                      {entry.price > 0 ? `${entry.currency} ${entry.price.toFixed(2)}` : "No price yet"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.price > 0 ? "estimate — adjust below if needed" : "quote before confirming"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <QueueEntryActions kind={entry.kind} bookingId={entry.id} />
                    <PriceQuoteForm
                      kind={entry.kind}
                      bookingId={entry.id}
                      currentPrice={entry.price}
                      currency={entry.currency}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
