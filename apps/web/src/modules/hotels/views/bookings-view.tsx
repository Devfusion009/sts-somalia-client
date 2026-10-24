import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
import type { HotelAccess } from "@/modules/hotels/hotel-access";
import { getPartnerBookings } from "@/modules/hotels/partner-queries";
import { markBookingPaid } from "@/modules/hotels/reservation-actions";
import { PAYMENT_METHOD_LABEL, type OfflinePaymentMethod } from "@/modules/hotels/reservation-types";
import { hotelGuestNames } from "@/modules/orders/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { dateSpan, money } from "@/lib/money";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingMoveActions } from "@/modules/hotels/components/booking-move-actions";
import type { ActionState } from "@/lib/auth/actions";
import { todayIso } from "@/modules/hotels/availability";

const STATUS_OVERRIDES = { no_show: "neutral" } as const;

type BookingRow = Awaited<ReturnType<typeof getPartnerBookings>>[number];

type MoveAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function BookingsTable({
  rows,
  hotelId,
  base,
  canManage,
  today,
  moveAction,
}: {
  rows: BookingRow[];
  hotelId: string;
  base: string;
  canManage: boolean;
  today: string;
  moveAction: MoveAction;
}) {
  return (
    <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead numeric>Rooms</TableHead>
              <TableHead numeric>Price</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? (
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`${base}/bookings/${b.id}`}
                    className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {hotelGuestNames(b.guest_details)[0] ?? "Guest"}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {b.hotel_rooms?.name}
                    {b.channel === "b2b" ? (
                      <Badge variant="info">Agency</Badge>
                    ) : b.source === "offline" ? (
                      <Badge variant="neutral">Offline</Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {dateSpan(b.check_in, b.check_out)}
                </TableCell>
                <TableCell numeric>{b.num_rooms}</TableCell>
                <TableCell numeric className="whitespace-nowrap">
                  {money(b.total_price, b.currency)}
                </TableCell>
                <TableCell>
                  {b.source !== "offline" || !b.payment_method ? (
                    <span className="text-sm text-muted-foreground">Online</span>
                  ) : b.paid_at ? (
                    <span className="flex items-center gap-1.5 text-sm">
                      {PAYMENT_METHOD_LABEL[b.payment_method as OfflinePaymentMethod]}
                      <Badge variant="success">Paid</Badge>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm">
                      {PAYMENT_METHOD_LABEL[b.payment_method as OfflinePaymentMethod]}
                      {canManage ? (
                        <form action={markBookingPaid}>
                          <input type="hidden" name="bookingId" value={b.id} />
                          <input type="hidden" name="hotelId" value={hotelId} />
                          <Button type="submit" size="xs" variant="outline">
                            Mark paid
                          </Button>
                        </form>
                      ) : (
                        <Badge variant="warning">Unpaid</Badge>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(b.status, STATUS_OVERRIDES)} className="capitalize">
                    {b.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                {canManage ? (
                  <TableCell numeric>
                    <BookingMoveActions
                      bookingId={b.id}
                      status={b.status}
                      checkIn={b.check_in}
                      today={today}
                      checkedIn={b.checked_in_at !== null}
                      action={moveAction}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </Card>
  );
}

const VIEWS = [
  { key: "all", label: "All", statuses: null },
  { key: "pending", label: "Needs a decision", statuses: ["pending", "waitlisted"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled", "refunded", "no_show"] },
] as const;

export async function BookingsView({
  hotelId,
  base,
  access,
  view: viewParam,
  moveAction,
  allowNewBooking,
}: {
  hotelId: string;
  base: string;
  access: HotelAccess;
  view?: string;
  moveAction: MoveAction;
  allowNewBooking: boolean;
}) {
  const view = VIEWS.find((v) => v.key === viewParam) ?? VIEWS[0];

  const bookings = await getPartnerBookings([hotelId]);
  const canManage = access.can("bookings");
  const today = todayIso();
  // Oldest request first: it has waited longest. Everything decided sits below.
  const counts = new Map<string, number>(
    VIEWS.map((v) => [v.key, v.statuses ? bookings.filter((b) => (v.statuses as readonly string[]).includes(b.status)).length : bookings.length])
  );
  const scoped = view.statuses ? bookings.filter((b) => (view.statuses as readonly string[]).includes(b.status)) : bookings;
  const requests = scoped
    .filter((b) => b.status === "pending" || b.status === "waitlisted")
    .sort((x, y) => x.created_at.localeCompare(y.created_at));
  const rest = scoped.filter((b) => b.status !== "pending" && b.status !== "waitlisted");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Bookings"
        actions={
          canManage && allowNewBooking ? (
            <Button render={<Link href={`${base}/bookings/new`} />}>
              <Plus aria-hidden="true" /> Book now
            </Button>
          ) : null
        }
      />

      <FilterChips
        label="Booking views"
        active={view.key}
        showZero
        items={VIEWS.map((v) => ({
          key: v.key,
          label: v.label,
          href: v.key === "all" ? `${base}/bookings` : `${base}/bookings?view=${v.key}`,
          count: counts.get(v.key) ?? 0,
        }))}
      />

      {scoped.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarCheck />
            </EmptyMedia>
            <EmptyTitle>{bookings.length === 0 ? "No bookings" : "No bookings in this view"}</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <>
          {requests.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-heading text-base font-semibold">Needs a decision</h2>
              <BookingsTable rows={requests} hotelId={hotelId} base={base} canManage={canManage} today={today} moveAction={moveAction} />
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section className="space-y-3">
              {requests.length > 0 ? <h2 className="font-heading text-base font-semibold">All bookings</h2> : null}
              <BookingsTable rows={rest} hotelId={hotelId} base={base} canManage={canManage} today={today} moveAction={moveAction} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
