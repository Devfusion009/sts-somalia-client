import type { Metadata } from "next";
import { getServerTrpc } from "@/lib/trpc/server";
import {
  TYPE_ICON,
  TYPE_LABEL,
  StatusBadge,
  formatMoney,
  formatDate,
} from "@/modules/bookings/components/booking-shared";
import type { UnifiedBooking } from "@/modules/bookings/types";
import { Card, CardContent } from "@/components/ui/card";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";

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
    return <UnavailableNotice label="Personal Bookings" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Personal Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bookings made on this account before it became an agent.
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">Nothing here</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              No bookings were made on this account before it became an agent.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {bookings.map((booking) => {
                const Icon = TYPE_ICON[booking.type];
                return (
                  <li key={`${booking.type}-${booking.id}`} className="flex items-center gap-4 px-5 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{booking.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TYPE_LABEL[booking.type]}
                        {formatDate(booking.travelDate ?? booking.createdAt) ? (
                          <> · {formatDate(booking.travelDate ?? booking.createdAt)}</>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={booking.status} />
                      <span className="w-24 text-right font-semibold">
                        {formatMoney(booking.price, booking.currency)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
