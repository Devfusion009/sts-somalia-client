import { format, formatDistanceToNow } from "date-fns";
import { BedDouble, PartyPopper, Inbox, Landmark, Briefcase, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBookingQueue } from "@/modules/admin/queue-queries";
import { QueueEntryActions, PriceQuoteForm } from "./queue-actions";

const formatQueueDate = (iso: string) => format(new Date(`${iso}T00:00:00`), "EEE d MMM yyyy");

export const metadata = { title: "Order Queue | Admin Console" };

/**
 * The manual-booking queue. Somali hotels and event halls have no booking
 * APIs — every request is confirmed by a human. Newest request first.
 */
export default async function OrderQueuePage() {
  const queue = await getBookingQueue();
  const waitlisted = queue.filter((q) => q.status === "waitlisted").length;
  // Rank is arrival order (oldest = #1); the list itself stays newest first.
  const rankById = new Map(
    [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q, n) => [q.id, n + 1])
  );
  const agencyCount = queue.filter((q) => q.channel === "b2b").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-xl font-semibold">Order Queue</h1>
        <Badge variant="secondary">{queue.length} waiting</Badge>
        {agencyCount > 0 ? (
          <Badge className="border-transparent bg-primary/10 font-medium text-primary">
            {agencyCount} agency
          </Badge>
        ) : null}
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
          {queue.map((entry) => (
            <Card
              key={`${entry.kind}-${entry.id}`}
              className={cn(
                // An agency request is a different counterparty: STS bills the
                // agency, the guest is the agency's client, and the margin is
                // theirs. Marked down the edge so the split is readable while
                // scanning the column, not only when reading a row.
                entry.channel === "b2b" && "border-l-4 border-l-primary",
                entry.status === "waitlisted" && "border-brand-gold/50"
              )}
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-heading text-lg font-bold text-muted-foreground/60">#{rankById.get(entry.id)}</span>
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
                      {entry.channel === "b2b" ? (
                        <Badge className="gap-1 border-transparent bg-primary font-semibold text-primary-foreground">
                          <Briefcase className="size-3" /> {entry.agencyName ?? "Agency"}
                        </Badge>
                      ) : null}
                      {entry.status === "waitlisted" ? (
                        <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                          {entry.displaced ? "Waitlisted — displaced by an agency booking" : "Waitlisted — dates full"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">New request</Badge>
                      )}
                    </p>
                    {entry.dates ? (
                      <p className="my-1 inline-flex items-center gap-2 rounded-md bg-primary px-2.5 py-1 text-sm font-semibold text-primary-foreground">
                        <CalendarDays className="size-4" />
                        {formatQueueDate(entry.dates.from)}
                        {entry.dates.to ? ` → ${formatQueueDate(entry.dates.to)}` : ""}
                      </p>
                    ) : null}
                    <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
                    {entry.channel === "b2b" ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {entry.travellerName ?? entry.customerName ?? "Guest"}
                        </span>
                        {entry.travellerName && entry.customerName
                          ? ` · booked by ${entry.customerName}`
                          : ""}
                        {" · placed "}
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {entry.customerName ?? entry.customerEmail ?? "Customer"} · placed{" "}
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <div className="text-right">
                    <p className="font-heading text-lg font-semibold">
                      {entry.price > 0 ? `${entry.currency} ${entry.price.toFixed(2)}` : "No price yet"}
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
