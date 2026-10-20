import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
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

const STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

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
  const knownAirlines = [
    ...new Set(departures.flatMap((d) => [d.outbound_airline, d.return_airline]).filter((a): a is string => !!a)),
  ].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackLink href="/admin/catalog/umrah" label="All packages" className="mb-3" />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">{pkg.name}</h1>
            <Badge className={cn("border-transparent capitalize", STATUS_STYLES[pkg.status])}>
              {pkg.status.replace("_", " ")}
            </Badge>
            {pkg.is_featured ? (
              <Badge className="border-transparent bg-brand-accent/15 text-brand-accent">Most Popular</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {pkg.duration_days} days · {pkg.currency} {Number(pkg.base_price).toFixed(0)} starting price
            {pkg.tier ? ` · ${pkg.tier}` : ""}
          </p>
        </div>
        {pkg.status === "published" ? (
          <Button variant="outline" className="gap-1.5" render={<Link href={`/umrah/${pkg.slug}`} target="_blank" />}>
            <ExternalLink className="size-4" /> View public page
          </Button>
        ) : null}
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
        <CardHeader>
          <CardTitle className="text-base">Departures</CardTitle>
          <CardAction>
            <DepartureDialog packageId={pkg.id} currency={pkg.currency} hasRateCard={hasRateCard} airlines={knownAirlines} />
          </CardAction>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departure</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Seats left</TableHead>
              <TableHead>Flights</TableHead>
              <TableHead>{hasRateCard ? "Sales close" : "Price override"}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {departures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No departures scheduled yet.
                </TableCell>
              </TableRow>
            ) : (
              departures.map((d) => {
                const seatsLeft = d.total_seats - d.booked_seats - d.offline_seats;
                const flights = [
                  [d.outbound_airline, d.outbound_flight_number].filter(Boolean).join(" "),
                  [d.return_airline, d.return_flight_number].filter(Boolean).join(" "),
                ].filter(Boolean);
                return (
                  <TableRow key={d.id}>
                    <TableCell>{formatDay(d.departure_date)}</TableCell>
                    <TableCell>{formatDay(d.return_date)}</TableCell>
                    <TableCell className="tabular-nums">
                      {d.booked_seats} + {d.offline_seats} offline / {d.total_seats}
                    </TableCell>
                    <TableCell className={cn("tabular-nums", seatsLeft <= 0 && "font-medium text-destructive")}>
                      {seatsLeft}
                    </TableCell>
                    <TableCell>{flights.length ? flights.join(" · ") : "—"}</TableCell>
                    <TableCell>
                      {hasRateCard
                        ? d.sales_close_days > 0
                          ? `${d.sales_close_days} days before`
                          : "On the day"
                        : d.price_override !== null
                          ? formatMoney(Number(d.price_override), pkg.currency)
                          : "—"}
                      {d.status !== "open" ? (
                        <Badge className="ml-2 border-transparent bg-muted capitalize text-muted-foreground">{d.status}</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
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
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
