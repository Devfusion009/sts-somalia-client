import Link from "next/link";
import { Plus } from "lucide-react";
import type { HotelAccess } from "@/modules/hotels/hotel-access";
import { getPartnerBookings } from "@/modules/hotels/partner-queries";
import { markBookingPaid } from "@/modules/hotels/reservation-actions";
import { PAYMENT_METHOD_LABEL, type OfflinePaymentMethod } from "@/modules/hotels/reservation-types";
import { hotelGuestNames } from "@/modules/orders/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingMoveActions } from "@/modules/hotels/components/booking-move-actions";
import type { ActionState } from "@/lib/auth/actions";
import { todayIso } from "@/modules/hotels/availability";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Action</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <Link href={`${base}/bookings/${b.id}`} className="hover:text-primary hover:underline">
                    {hotelGuestNames(b.guest_details)[0] ?? "Guest"}
                  </Link>
                </TableCell>
                <TableCell>
                  {b.hotel_rooms?.name}
                  {b.channel === "b2b" ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">Agency</span>
                  ) : b.source === "offline" ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">Offline</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {b.check_in} → {b.check_out}
                </TableCell>
                <TableCell>{b.num_rooms}</TableCell>
                <TableCell>
                  {b.currency} {Number(b.total_price).toFixed(0)}
                </TableCell>
                <TableCell>
                  {b.source !== "offline" || !b.payment_method ? (
                    <span className="text-sm text-muted-foreground">Online</span>
                  ) : b.paid_at ? (
                    <span className="text-sm">
                      {PAYMENT_METHOD_LABEL[b.payment_method as OfflinePaymentMethod]}
                      <span className="ml-1.5 text-xs font-medium text-primary">Paid</span>
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
                        <span className="text-xs font-medium text-brand-gold">Unpaid</span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`border-transparent capitalize ${STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {b.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
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
      </div>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Bookings</h1>
        {canManage && allowNewBooking ? (
          <Button className="gap-1.5" render={<Link href={`${base}/bookings/new`} />}>
            <Plus className="size-4" /> Book now
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Booking views">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "all" ? `${base}/bookings` : `${base}/bookings?view=${v.key}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              v.key === view.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
            <span className="text-xs tabular-nums opacity-80">{counts.get(v.key)}</span>
          </Link>
        ))}
      </nav>

      {scoped.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No bookings.</CardContent>
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
