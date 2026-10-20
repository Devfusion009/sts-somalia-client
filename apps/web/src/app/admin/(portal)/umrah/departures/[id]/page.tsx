import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getDepartureAdmin } from "@/modules/umrah/departure-admin-queries";
import { formatMoney } from "@/modules/umrah/pricing";
import { ReadinessBadges } from "@/modules/umrah/components/pilgrim-editor";
import { ORDER_STATUS_LABELS, UMRAH_STAGE_LABELS, isUmrahStage } from "../../bookings/stages";
import { formatDay } from "../../bookings/shared";
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

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

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
    );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <BackLink href="/admin/umrah/departures" label="All departures" className="mb-3" />
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{departure.package?.name ?? "Umrah"}</h1>
            <Badge
              className={cn(
                "border-transparent capitalize",
                departure.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              )}
            >
              {departure.status}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              {departure.package ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  aria-label="Edit departure"
                  render={<Link href={`/admin/catalog/umrah/${departure.package.id}`} />}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
              {departure.status !== "cancelled" ? <CancelDepartureButton departureId={departure.id} label={dates} /> : null}
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              dates,
              [departure.outbound_airline, departure.outbound_flight_number].filter(Boolean).join(" ") || null,
              [departure.return_airline, departure.return_flight_number].filter(Boolean).join(" ") || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-secondary/40 px-4 py-3 text-sm">
          <Stat label="Seats" value={departure.total_seats} />
          <Stat label="Booked" value={departure.booked_seats} />
          <Stat label="Offline" value={departure.offline_seats} />
          <Stat label="Free" value={free} />
          <Stat label="Bookings" value={bookingIds.length} />
          <Stat label="Pilgrims ready" value={`${ready} / ${manifest.length}`} />
          <Stat label="Outstanding" value={formatMoney(outstanding, currency)} />
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/umrah/departures/${departure.id}`} className={chip(activeTab === "manifest")}>
          Manifest
        </Link>
        <Link href={`/admin/umrah/departures/${departure.id}?tab=rooming`} className={chip(activeTab === "rooming")}>
          Rooming
        </Link>
        <div className="ml-auto flex gap-2">
          {activeTab === "rooming" ? <AddRoomDialog departureId={departure.id} /> : null}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={<a href={`/api/admin/umrah-manifest/${departure.id}`} />}
          >
            <Download className="size-3.5" /> Manifest CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={<a href={`/api/admin/umrah-manifest/${departure.id}?kind=rooming`} />}
          >
            <Download className="size-3.5" /> Rooming CSV
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pilgrim</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Passport</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Rooms</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifest.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No pilgrims on this departure.
                      </TableCell>
                    </TableRow>
                  ) : (
                    manifest.map((m) => (
                      <TableRow key={m.pilgrim_id}>
                        <TableCell>
                          <p className="font-medium">{m.full_name}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {[m.gender, m.nationality, m.date_of_birth ? formatDay(m.date_of_birth) : null].filter(Boolean).join(" · ")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{m.order_number ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[guestOf(m), m.agency_name, m.order_status ? (ORDER_STATUS_LABELS[m.order_status] ?? m.order_status) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{m.passport_number ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.passport_expiry ? formatDay(m.passport_expiry) : ""}</p>
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
                        <TableCell className="tabular-nums">
                          {Number(m.balance) > 0 ? formatMoney(Number(m.balance), m.currency) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isUmrahStage(m.fulfillment_stage) ? UMRAH_STAGE_LABELS[m.fulfillment_stage] : m.fulfillment_stage}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-8"
                            aria-label="Open booking"
                            render={<Link href={`/admin/umrah/bookings/${m.booking_id}`} />}
                          >
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-base font-semibold">
                    {city.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {unroomed.length} without a room
                    </span>
                  </h2>
                </div>
                <Card className="overflow-hidden py-0">
                  {cityRooms.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted-foreground">No rooms.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {cityRooms.map((room) => (
                        <li key={room.id} className="space-y-2 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="flex-1 text-sm font-medium">
                              Room {room.room_label}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
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
