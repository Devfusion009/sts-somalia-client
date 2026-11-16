import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { getServerTrpc } from "@/lib/trpc/server";
import { TYPE_ICON, TYPE_LABEL, formatDate } from "@/modules/bookings/components/booking-shared";
import type { UnifiedBooking } from "@/modules/bookings/types";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Personal Bookings" };

/**
 * Read-only: orders this account made as a customer, before its agency
 * application was approved and the role converted to agent (see
 * account/layout.tsx — /account itself is no longer reachable from this
 * role). Booked-for-customer orders processed through the agency belong on
 * /agent/bookings instead; myPersonalBookings filters those out.
 */
export default async function AgentPersonalBookingsPage() {
  const trpc = await getServerTrpc();
  let bookings: UnifiedBooking[];
  try {
    ({ bookings } = await trpc.bookings.myPersonalBookings.query());
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Personal bookings" />
        <UnavailableNotice label="Personal bookings" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal bookings"
        meta={bookings.length > 0 ? `${bookings.length} booking${bookings.length === 1 ? "" : "s"}` : undefined}
      />

      <Card className="overflow-hidden py-0">
        {bookings.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>No personal bookings</EmptyTitle>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((booking) => {
              const Icon = TYPE_ICON[booking.type];
              const date = formatDate(booking.travelDate ?? booking.createdAt);
              return (
                <li
                  key={`${booking.type}-${booking.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{booking.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {TYPE_LABEL[booking.type]}
                      {date ? <> · {date}</> : null}
                    </p>
                  </div>
                  <div className="ml-13 flex items-center gap-3 sm:ml-0">
                    <Badge variant={statusBadgeVariant(booking.status)} className="capitalize">
                      {booking.status.replace(/_/g, " ")}
                    </Badge>
                    <span className="min-w-28 text-right text-sm font-medium tabular-nums">
                      {<AgentMoney value={money(booking.price, booking.currency)} />}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
