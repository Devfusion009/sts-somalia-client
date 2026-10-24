import { format, formatDistanceToNow } from "date-fns";
import { BedDouble, PartyPopper, Inbox, Landmark, Briefcase, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { getBookingQueue } from "@/modules/admin/queue-queries";
import { QueueEntryActions, PriceQuoteForm } from "./queue-actions";
import { expirePastHallRequests } from "@/modules/events/venue-manager-queries";
import { money } from "@/lib/money";

const formatQueueDate = (iso: string) => format(new Date(`${iso}T00:00:00`), "EEE d MMM yyyy");

export const metadata = { title: "Order Queue" };

/**
 * The manual-booking queue. Somali hotels and event halls have no booking
 * APIs — every request is confirmed by a human. Newest request first.
 */
export default async function OrderQueuePage() {
  await expirePastHallRequests(null);
  const queue = await getBookingQueue();
  const waitlisted = queue.filter((q) => q.status === "waitlisted").length;
  // Rank is arrival order (oldest = #1); the list itself stays newest first.
  const rankById = new Map(
    [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q, n) => [q.id, n + 1])
  );
  const agencyCount = queue.filter((q) => q.channel === "b2b").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Queue"
        status={
          <>
            <Badge variant="neutral" className="tabular-nums">
              {queue.length} waiting
            </Badge>
            {agencyCount > 0 ? (
              <Badge variant="info" className="tabular-nums">
                {agencyCount} agency
              </Badge>
            ) : null}
            {waitlisted > 0 ? (
              <Badge variant="warning" className="tabular-nums">
                {waitlisted} waitlisted
              </Badge>
            ) : null}
          </>
        }
      />

      {queue.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Queue is clear</EmptyTitle>
            </Empty>
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
                entry.status === "waitlisted" && "ring-brand-gold/50"
              )}
            >
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="w-7 shrink-0 pt-2 text-right font-heading text-sm font-semibold text-muted-foreground tabular-nums"
                    aria-label={`Position ${rankById.get(entry.id)}`}
                  >
                    #{rankById.get(entry.id)}
                  </span>
                  <span
                    className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex"
                    aria-hidden="true"
                  >
                    {entry.kind === "hotel" ? (
                      <BedDouble className="size-5" />
                    ) : entry.kind === "hall" ? (
                      <PartyPopper className="size-5" />
                    ) : (
                      <Landmark className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="min-w-0 break-words">{entry.title}</span>
                      {entry.channel === "b2b" ? (
                        <Badge variant="info">
                          <Briefcase aria-hidden="true" /> {entry.agencyName ?? "Agency"}
                        </Badge>
                      ) : null}
                      {entry.status === "waitlisted" ? (
                        <Badge variant="warning" className="max-w-full whitespace-normal">
                          {entry.displaced ? "Waitlisted — displaced by an agency booking" : "Waitlisted — dates full"}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">New request</Badge>
                      )}
                    </p>
                    {entry.dates ? (
                      <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        {formatQueueDate(entry.dates.from)}
                        {entry.dates.to ? ` – ${formatQueueDate(entry.dates.to)}` : ""}
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
                <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between lg:border-0 lg:pt-0 lg:gap-5">
                  <p
                    className={cn(
                      "font-heading text-lg font-semibold tabular-nums sm:text-right",
                      entry.price <= 0 && "text-sm font-medium text-muted-foreground"
                    )}
                  >
                    {entry.price > 0
                      ? money(entry.price, entry.currency)
                      : "No price"}
                  </p>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
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
