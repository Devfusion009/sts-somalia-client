import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, Pencil, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDepartureAdmin } from "@/modules/umrah/departure-admin-queries";
import { formatMoney } from "@/modules/umrah/pricing";
import { ReadinessBadges } from "@/modules/umrah/components/pilgrim-editor";
import { ORDER_STATUS_LABELS, isUmrahStage } from "../../bookings/stages";
import { StageBadge, formatDay } from "../../bookings/shared";
import {
  AddRoomDialog,
  AssignOccupantForm,
  BulkStageForm,
  CancelDepartureButton,
  DeleteRoomButton,
  RemoveOccupantButton,
} from "../departure-forms";

export const metadata: Metadata = { title: "Umrah Departure" };

const CITIES = [
  { key: "makkah", label: "Makkah" },
  { key: "madinah", label: "Madinah" },
] as const;

const GENDER_LABEL: Record<string, string> = { male: "Men", female: "Women", family: "Family" };

const STATUS_OVERRIDES = { open: "success", full: "warning" } as const;

export default async function AdminUmrahDeparturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const data = await getDepartureAdmin(id);
  if (!data) notFound();
  const { departure, manifest, rooms } = data;
  const activeTab = tab === "rooming" ? "rooming" : "manifest";

  const currency = departure.package?.currency ?? "USD";
  const bookingIds = [...new Set(manifest.map((m) => m.booking_id))];
  const ready = manifest.filter((m) => m.missing.length === 0).length;
  const outstanding = bookingIds.reduce(
    (sum, bookingId) => sum + Number(manifest.find((m) => m.booking_id === bookingId)?.balance ?? 0),
    0
  );
  const free = departure.total_seats - departure.booked_seats - departure.offline_seats;
  const dates = `${formatDay(departure.departure_date)} – ${formatDay(departure.return_date)}`;
  const pilgrimName = new Map(manifest.map((m) => [m.pilgrim_id, m.full_name]));
  const guestOf = (m: (typeof manifest)[number]) => m.guest_name ?? m.customer_name ?? "Customer";

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <BackLink href="/admin/umrah/departures" label="All departures" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">
                {departure.package?.name ?? "Umrah"}
              </h1>
              <Badge variant={statusBadgeVariant(departure.status, STATUS_OVERRIDES)} className="capitalize">
                {departure.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {[
                dates,
                [departure.outbound_airline, departure.outbound_flight_number].filter(Boolean).join(" ") || null,
                [departure.return_airline, departure.return_flight_number].filter(Boolean).join(" ") || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {departure.package ? (
              <Button
                size="icon"
                variant="outline"
                aria-label="Edit departure"
                title="Edit in catalog"
                render={<Link href={`/admin/catalog/umrah/${departure.package.id}`} />}
              >
                <Pencil />
              </Button>
            ) : null}
            {departure.status !== "cancelled" ? <CancelDepartureButton departureId={departure.id} label={dates} /> : null}
          </div>
        </header>

        <StatRail className="lg:grid-cols-7">
          <StatRailItem label="Seats" value={departure.total_seats} />
          <StatRailItem label="Booked" value={departure.booked_seats} />
          <StatRailItem label="Offline" value={departure.offline_seats} />
          <StatRailItem label="Free" value={free} tone={free <= 0 ? "destructive" : undefined} />
          <StatRailItem label="Bookings" value={bookingIds.length} />
          <StatRailItem
            label="Pilgrims ready"
            value={`${ready} / ${manifest.length}`}
            tone={ready < manifest.length ? "warn" : undefined}
          />
          <StatRailItem label="Outstanding" value={formatMoney(outstanding, currency)} tone={outstanding > 0 ? "warn" : undefined} />
        </StatRail>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          label="Departure view"
          active={activeTab}
          items={[
            { key: "manifest", label: "Manifest", href: `/admin/umrah/departures/${departure.id}` },
            { key: "rooming", label: "Rooming", href: `/admin/umrah/departures/${departure.id}?tab=rooming` },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {activeTab === "rooming" ? <AddRoomDialog departureId={departure.id} /> : null}
          <Button variant="outline" nativeButton={false} render={<a href={`/api/admin/umrah-manifest/${departure.id}`} />}>
            <Download aria-hidden="true" /> Manifest CSV
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/api/admin/umrah-manifest/${departure.id}?kind=rooming`} />}
          >
            <Download aria-hidden="true" /> Rooming CSV
          </Button>
        </div>
      </div>

      {activeTab === "manifest" ? (
        <>
          {departure.status !== "cancelled" ? (
            <Card>
              <CardContent>
                <BulkStageForm departureId={departure.id} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden py-0">
            {manifest.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No pilgrims on this departure</EmptyTitle>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pilgrim</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Passport</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Rooms</TableHead>
                    <TableHead numeric>Balance</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead numeric>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifest.map((m) => (
                    <TableRow key={m.pilgrim_id}>
                      <TableCell>
                        <p className="font-medium">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground capitalize tabular-nums">
                          {[m.gender, m.nationality, m.date_of_birth ? formatDay(m.date_of_birth) : null].filter(Boolean).join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/umrah/bookings/${m.booking_id}`}
                          className="rounded-sm font-mono text-xs outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {m.order_number ?? "—"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {[guestOf(m), m.agency_name, m.order_status ? (ORDER_STATUS_LABELS[m.order_status] ?? m.order_status) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs">{m.passport_number ?? "—"}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {m.passport_expiry ? formatDay(m.passport_expiry) : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-56 flex-wrap gap-1">
                          <ReadinessBadges readiness={{ missing: m.missing, warnings: m.warnings }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {[m.room_makkah ? `Makkah ${m.room_makkah}` : null, m.room_madinah ? `Madinah ${m.room_madinah}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap">
                        {Number(m.balance) > 0 ? (
                          formatMoney(Number(m.balance), m.currency)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isUmrahStage(m.fulfillment_stage) ? (
                          <StageBadge stage={m.fulfillment_stage} />
                        ) : (
                          <span className="text-xs">{m.fulfillment_stage}</span>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Open booking for ${m.full_name}`}
                          title="Open booking"
                          render={<Link href={`/admin/umrah/bookings/${m.booking_id}`} />}
                        >
                          <ChevronRight />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {CITIES.map((city) => {
            const cityRooms = rooms.filter((r) => r.city === city.key);
            const roomed = new Set(cityRooms.flatMap((r) => r.occupants));
            const unroomed = manifest.filter((m) => !roomed.has(m.pilgrim_id));
            const bookingOptions = [...new Set(unroomed.map((m) => m.booking_id))]
              .map((bookingId) => {
                const members = manifest.filter((m) => m.booking_id === bookingId);
                if (members.some((m) => roomed.has(m.pilgrim_id))) return null;
                const first = members[0];
                return {
                  value: `booking:${bookingId}`,
                  label: `${guestOf(first)} · whole booking (${members.length})`,
                };
              })
              .filter((o): o is { value: string; label: string } => !!o);
            const options = [
              ...bookingOptions,
              ...unroomed.map((m) => ({ value: m.pilgrim_id, label: `${m.full_name} · ${guestOf(m)}` })),
            ];

            return (
              <section key={city.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-base font-semibold">{city.label}</h2>
                  {unroomed.length > 0 ? (
                    <Badge variant="warning" className="tabular-nums">
                      {unroomed.length} without a room
                    </Badge>
                  ) : null}
                </div>
                <Card className="overflow-hidden py-0">
                  {cityRooms.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted-foreground">No rooms</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {cityRooms.map((room) => (
                        <li key={room.id} className="space-y-2 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="flex-1 text-sm font-medium">
                              Room {room.room_label}
                              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                                {[`${room.occupants.length} / ${room.capacity}`, room.gender ? GENDER_LABEL[room.gender] : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </p>
                            <DeleteRoomButton roomId={room.id} label={room.room_label} />
                          </div>
                          {room.occupants.length > 0 ? (
                            <ul className="flex flex-wrap gap-1.5">
                              {room.occupants.map((pilgrimId) => (
                                <li
                                  key={pilgrimId}
                                  className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
                                >
                                  {pilgrimName.get(pilgrimId) ?? "Pilgrim"}
                                  <RemoveOccupantButton
                                    roomId={room.id}
                                    pilgrimId={pilgrimId}
                                    departureId={departure.id}
                                    name={pilgrimName.get(pilgrimId) ?? "pilgrim"}
                                  />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {room.occupants.length < room.capacity ? (
                            <AssignOccupantForm roomId={room.id} options={options} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
