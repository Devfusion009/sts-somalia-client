import { Fragment } from "react";
import { privatePackageGroupKey } from "@/modules/umrah/private-package-groups";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Inbox, CalendarDays, UsersRound, BedDouble, Building2, ChevronDown, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { getSubmittedUmrahRequests } from "@/modules/umrah/custom-queries";
import { categoryLabel, ROOM_SHARING_LABELS, UMRAH_TIER_LABELS } from "@/modules/umrah/services";
import { formatMoney, tripDurationDays, tripReturnDate } from "@/modules/umrah/pricing";
import { UmrahRequestActions, UmrahPriceQuoteForm } from "./request-actions";
import styles from "./requests.module.css";
import { PriceAdjustment } from "@/modules/umrah/components/price-adjustment";

export const metadata = { title: "Private Umrah Requests" };

function formatDate(value: string | null) {
  if (!value) return "Dates to confirm";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Private Umrah requests waiting on a human, newest first.
 *
 * These are quoted, not open-ended: the customer has already seen and agreed
 * a total built from the service catalog. What still needs a person is
 * availability — the hotels, the seats and the visa slots for those exact
 * dates. Confirming here is what lets the customer pay.
 */
export default async function AdminUmrahRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const params = await searchParams;
  const selectedStatus = ["pending", "confirmed", "cancelled"].includes(params.status ?? "") ? params.status! : "all";
  const query = params.q?.trim() ?? "";
  const requests = await getSubmittedUmrahRequests();
  const pending = requests.filter((r) => {
    const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
    return !booking || booking.status === "pending";
  });

  const statusOf = (request: typeof requests[number]) => {
    const booking = Array.isArray(request.booking) ? request.booking[0] : request.booking;
    return booking?.status ?? "pending";
  };
  const tabs = [
    { key: "all", label: "All requests", count: requests.length },
    { key: "pending", label: "Awaiting review", count: pending.length },
    { key: "confirmed", label: "Confirmed", count: requests.filter((r) => statusOf(r) === "confirmed").length },
    { key: "cancelled", label: "Cancelled", count: requests.filter((r) => statusOf(r) === "cancelled").length },
  ];
  const visible = requests.filter((request) => {
    const customer = Array.isArray(request.customer) ? request.customer[0] : request.customer;
    return (selectedStatus === "all" || statusOf(request) === selectedStatus) &&
      [request.reference, customer?.full_name, customer?.email, customer?.phone].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase());
  });

  const grouped = new Map<string, typeof visible>();
  for (const request of visible) {
    const key = privatePackageGroupKey(request);
    grouped.set(key, [...(grouped.get(key) ?? []), request]);
  }
  const ordered = [...grouped.values()].flat();
  return (
    <div className={styles.page}>
      <PageHeader
        title="Private Umrah requests"
        status={
          pending.length > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {pending.length} waiting
            </Badge>
          ) : null
        }

      />

      <section className={styles.toolbar} aria-label="Request filters">
        <nav className={styles.tabs} aria-label="Request status">
          {tabs.map((tab) => {
            const search = new URLSearchParams();
            if (tab.key !== "all") search.set("status", tab.key);
            if (query) search.set("q", query);
            return <Link key={tab.key} href={`/admin/umrah/requests?${search}`} aria-current={selectedStatus === tab.key ? "page" : undefined}>{tab.label}<span>{tab.count}</span></Link>;
          })}
        </nav>
        <form className={styles.search} role="search">
          {selectedStatus !== "all" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <Search className="size-4" aria-hidden="true" />
          <input name="q" defaultValue={query} type="search" placeholder="Reference, customer or phone" aria-label="Search requests" />
          <button type="submit">Search</button>
        </form>
      </section>
      {visible.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>{requests.length ? "No matching requests" : "No private Umrah requests"}</EmptyTitle>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ordered.map((request, index) => {
            const booking = Array.isArray(request.booking) ? request.booking[0] : request.booking;
            const customer = Array.isArray(request.customer)
              ? request.customer[0]
              : request.customer;
            const trip = {
              numPilgrims: request.num_pilgrims,
              nightsMakkah: request.nights_makkah,
              nightsMadinah: request.nights_madinah,
            };
            const duration = request.package_snapshot ? Math.round((Date.parse(request.package_snapshot.returnDate) - Date.parse(request.package_snapshot.departureDate)) / 86400000) + 1 : tripDurationDays(trip);
            const returnDate = request.package_snapshot?.returnDate ?? tripReturnDate(request.departure_date, trip);
            const price = booking ? Number(booking.total_price) : request.subtotal;
            const currency = booking?.currency ?? request.currency;
            const settled = booking && booking.status !== "pending";

            return (
              <Fragment key={request.id}>
              {request.package_snapshot && (index === 0 || privatePackageGroupKey(ordered[index - 1]) !== privatePackageGroupKey(request)) ? <header className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                <h2 className="font-heading text-lg font-semibold">{request.package_snapshot.name}</h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span>{request.package_snapshot.origin} → {request.package_snapshot.destination}</span>
                  <span>{formatDate(request.package_snapshot.departureDate)} – {formatDate(request.package_snapshot.returnDate)}</span>
                  <Badge variant="info">{grouped.get(privatePackageGroupKey(request))!.length} requests · {grouped.get(privatePackageGroupKey(request))!.reduce((n, r) => n + r.num_pilgrims, 0)} travellers</Badge>
                </div>
              </header> : null}
              <Card className={styles.request} data-pending={!settled || undefined}>
                <CardContent className="p-0">
                  <header className={styles.requestHeader}>
                    <div className={styles.identity}>
                      <span className={styles.avatar} aria-hidden="true"><UsersRound /></span>
                      <div className="min-w-0">
                        <div className={styles.reference}>
                          <h2>{request.reference}</h2>
                          <Badge variant={booking ? (booking.status === "pending" ? "warning" : statusBadgeVariant(booking.status)) : "warning"} className="capitalize">{booking?.status && booking.status !== "pending" ? booking.status.replace(/_/g, " ") : "Awaiting review"}</Badge>
                          <Badge variant="neutral">{UMRAH_TIER_LABELS[request.tier]}</Badge>
                        </div>
                        <div className={styles.customer}>{customer?.full_name ?? customer?.email ?? "Customer"}{customer?.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : null}</div>
                        <span className={styles.created}>Received {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className={styles.total}><span>Quoted total</span><strong>{formatMoney(price, currency)}</strong></div>
                  </header>
                  <dl className={styles.trip}>
                    <div><dt><CalendarDays aria-hidden="true" />Travel dates</dt><dd>{formatDate(request.departure_date)}{returnDate ? ` – ${formatDate(returnDate)}` : ""}</dd></div>
                    <div><dt><UsersRound aria-hidden="true" />Travellers</dt><dd>{request.num_pilgrims} <span>· {duration} days</span></dd></div>
                    <div><dt><BedDouble aria-hidden="true" />Room</dt><dd>{ROOM_SHARING_LABELS[request.room_sharing] ?? request.room_sharing}</dd></div>
                    <div><dt><Building2 aria-hidden="true" />Stay</dt><dd>{request.nights_makkah} nights Makkah <span>· {request.nights_madinah} Madinah</span></dd></div>
                  </dl>

                  <details className={styles.services} open={!settled}>
                    <summary>{request.package_snapshot ? "Package & facilities" : "Selected services"} <span>{request.services.length}</span><ChevronDown aria-hidden="true" /></summary>
                    {request.package_snapshot?.includes.length ? <div className="mt-3 flex flex-wrap gap-2">{request.package_snapshot.includes.map((facility) => <Badge key={facility} variant="neutral">{facility}</Badge>)}</div> : null}
                    <ul className={styles.serviceList}>
                      {request.services.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium">{line.name}</span>
                            <span className="block text-xs text-muted-foreground tabular-nums">
                              {categoryLabel(line.category)} · {formatMoney(line.unit_price, currency)} × {line.quantity}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums">{formatMoney(line.line_total, currency)}</span>
                        </li>
                      ))}
                      <PriceAdjustment total={price} lines={request.services} currency={currency} />
                    </ul>
                  </details>
                  {request.notes ? <div className={styles.notes}><h3>Customer notes</h3><p>{request.notes}</p></div> : null}

                  {booking && !settled ? (
                    <div className={styles.review}>
                      <div><h3>Review & quote</h3><UmrahPriceQuoteForm bookingId={booking.id} currentPrice={price} currency={currency} /></div>
                      <UmrahRequestActions bookingId={booking.id} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
