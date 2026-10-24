import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahPackageById, getActiveAgenciesForPicker } from "@/modules/admin/queries";
import { getServerTrpc } from "@/lib/trpc/server";
import { umrahImagePaths } from "@/modules/umrah/images";
import { formatMoney } from "@/modules/umrah/pricing";
import { cn } from "@/lib/utils";
import { DepartureDialog, DeleteDepartureButton } from "./departures-form";
import { GalleryManager } from "./gallery-manager";
import { PackageDetailsForm } from "./package-details-form";
import { HotelsManager, ItineraryManager, PricingManager, AgenciesPicker } from "./package-config-forms";

const DEPARTURE_OVERRIDES = { full: "warning" } as const;

function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function UmrahPackageConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getServerTrpc();
  const [pkg, agencies, airports] = await Promise.all([
    getUmrahPackageById(id),
    getActiveAgenciesForPicker(),
    trpc.flights.airports.query().catch(() => []),
  ]);
  if (!pkg) notFound();

  const departures = [...(pkg.umrah_package_departures ?? [])].sort((a, b) =>
    a.departure_date.localeCompare(b.departure_date)
  );
  const hotels = [...(pkg.umrah_package_hotels ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const itinerary = [...(pkg.umrah_itinerary_days ?? [])].sort((a, b) => a.day_number - b.day_number);
  const pricing = [...(pkg.umrah_package_pricing ?? [])].sort((a, b) => a.sharing - b.sharing);
  const linkedAgencyIds = (pkg.umrah_package_agencies ?? []).map((a) => a.agency_id);
  const hasRateCard = pricing.length > 0;
  const seatsLeftTotal = departures.reduce((sum, d) => sum + Math.max(d.total_seats - d.booked_seats - d.offline_seats, 0), 0);
  const knownAirlines = [
    ...new Set(departures.flatMap((d) => [d.outbound_airline, d.return_airline]).filter((a): a is string => !!a)),
  ].sort();

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <BackLink href="/admin/catalog/umrah" label="All packages" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{pkg.name}</h1>
              <Badge variant={statusBadgeVariant(pkg.status)} className="capitalize">
                {pkg.status.replace(/_/g, " ")}
              </Badge>
              {pkg.is_featured ? <Badge variant="info">Most popular</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {[`${pkg.duration_days} days`, pkg.tier, pkg.origin_iata && pkg.destination_iata ? `${pkg.origin_iata} → ${pkg.destination_iata}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {pkg.status === "published" ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Open public page"
                title="Open public page"
                render={<Link href={`/umrah/${pkg.slug}`} target="_blank" />}
              >
                <ExternalLink />
              </Button>
            </div>
          ) : null}
        </header>

        <StatRail>
          <StatRailItem label="Starting price" value={formatMoney(Number(pkg.base_price), pkg.currency)} />
          <StatRailItem label="Departures" value={departures.length} />
          <StatRailItem label="Seats left" value={seatsLeftTotal} tone={departures.length > 0 && seatsLeftTotal <= 0 ? "destructive" : undefined} />
          <StatRailItem label="Rate card" value={hasRateCard ? `${pricing.length} rates` : "Not set"} tone={hasRateCard ? undefined : "warn"} />
        </StatRail>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <GalleryManager packageId={pkg.id} paths={umrahImagePaths(pkg.images)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Package details</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageDetailsForm
            packageId={pkg.id}
            tagline={pkg.tagline}
            tier={pkg.tier}
            isFeatured={pkg.is_featured}
            originIata={pkg.origin_iata}
            destinationIata={pkg.destination_iata}
            airports={airports}
            originalPrice={pkg.original_price === null ? null : Number(pkg.original_price)}
            currency={pkg.currency}
            mealPlan={pkg.meal_plan}
            mealsNote={pkg.meals_note}
            contactPersonName={pkg.contact_person_name}
            contactPersonPhone={pkg.contact_person_phone}
            contactPersonEmail={pkg.contact_person_email}
            contactWhatsapp={pkg.contact_whatsapp}
            depositPercent={pkg.deposit_percent === null ? null : Number(pkg.deposit_percent)}
            balanceDueDays={pkg.balance_due_days}
            fullPaymentBeforeDocuments={pkg.full_payment_before_documents}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hotels</CardTitle>
          </CardHeader>
          <CardContent>
            <HotelsManager packageId={pkg.id} hotels={hotels} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate card</CardTitle>
          </CardHeader>
          <CardContent>
            <PricingManager packageId={pkg.id} rows={pricing.map((p) => ({ ...p, price: Number(p.price) }))} currency={pkg.currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Day-by-day plan</CardTitle>
        </CardHeader>
        <CardContent>
          <ItineraryManager packageId={pkg.id} days={itinerary} durationDays={pkg.duration_days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local agencies</CardTitle>
        </CardHeader>
        <CardContent>
          <AgenciesPicker packageId={pkg.id} agencies={agencies} selectedIds={linkedAgencyIds} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden pb-0">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Departures</CardTitle>
          <CardAction>
            <DepartureDialog packageId={pkg.id} currency={pkg.currency} hasRateCard={hasRateCard} airlines={knownAirlines} />
          </CardAction>
        </CardHeader>
        {departures.length === 0 ? (
          <Empty className="border-t border-border">
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>No departures</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departure</TableHead>
                <TableHead>Return</TableHead>
                <TableHead numeric>Seats</TableHead>
                <TableHead numeric>Left</TableHead>
                <TableHead>Flights</TableHead>
                <TableHead>{hasRateCard ? "Sales close" : "Price override"}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departures.map((d) => {
                const seatsLeft = d.total_seats - d.booked_seats - d.offline_seats;
                const flights = [
                  [d.outbound_airline, d.outbound_flight_number].filter(Boolean).join(" "),
                  [d.return_airline, d.return_flight_number].filter(Boolean).join(" "),
                ].filter(Boolean);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDay(d.departure_date)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDay(d.return_date)}</TableCell>
                    <TableCell numeric className="whitespace-nowrap">
                      {d.booked_seats}
                      {d.offline_seats > 0 ? <span className="text-muted-foreground"> + {d.offline_seats} offline</span> : null}
                      <span className="text-muted-foreground"> / {d.total_seats}</span>
                    </TableCell>
                    <TableCell numeric className={cn(seatsLeft <= 0 && "font-medium text-destructive")}>
                      {seatsLeft}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{flights.length ? flights.join(" · ") : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {hasRateCard
                        ? d.sales_close_days > 0
                          ? `${d.sales_close_days} days before`
                          : "On the day"
                        : d.price_override !== null
                          ? formatMoney(Number(d.price_override), pkg.currency)
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(d.status, DEPARTURE_OVERRIDES)} className="capitalize">
                        {d.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      <div className="flex justify-end gap-1">
                        <DepartureDialog
                          packageId={pkg.id}
                          currency={pkg.currency}
                          departure={d}
                          hasRateCard={hasRateCard}
                          airlines={knownAirlines}
                        />
                        {d.booked_seats === 0 ? (
                          <DeleteDepartureButton departureId={d.id} label={formatDay(d.departure_date)} />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
