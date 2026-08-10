import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahPackageById, getActiveAgenciesForPicker } from "@/modules/admin/queries";
import { getAirports } from "@/modules/flights/queries";
import { umrahImagePaths } from "@/modules/umrah/images";
import { cn } from "@/lib/utils";
import { DeparturesForm } from "./departures-form";
import { GalleryManager } from "./gallery-manager";
import { PackageDetailsForm } from "./package-details-form";
import { HotelsManager, ItineraryManager, PricingManager, AgenciesPicker } from "./package-config-forms";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function UmrahPackageConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pkg, agencies, airports] = await Promise.all([
    getUmrahPackageById(id),
    getActiveAgenciesForPicker(),
    getAirports(),
  ]);
  if (!pkg) notFound();

  const departures = [...(pkg.umrah_package_departures ?? [])].sort((a, b) =>
    a.departure_date.localeCompare(b.departure_date)
  );
  const hotels = [...(pkg.umrah_package_hotels ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const itinerary = [...(pkg.umrah_itinerary_days ?? [])].sort((a, b) => a.day_number - b.day_number);
  const pricing = [...(pkg.umrah_package_pricing ?? [])].sort((a, b) => a.sharing - b.sharing);
  const linkedAgencyIds = (pkg.umrah_package_agencies ?? []).map((a) => a.agency_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 gap-1 text-muted-foreground"
            render={<Link href="/admin/catalog/umrah" />}
          >
            <ArrowLeft className="size-3.5" /> All packages
          </Button>
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
          <CardDescription>The first image is the cover shown on cards and the package hero.</CardDescription>
        </CardHeader>
        <CardContent>
          <GalleryManager packageId={pkg.id} paths={umrahImagePaths(pkg.images)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Package details</CardTitle>
          <CardDescription>Badge, route, discount, meals, and who&apos;s responsible for this package.</CardDescription>
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
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hotels</CardTitle>
            <CardDescription>Makkah and Madinah properties, with star rating and distance to the Haram.</CardDescription>
          </CardHeader>
          <CardContent>
            <HotelsManager packageId={pkg.id} hotels={hotels} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate card</CardTitle>
            <CardDescription>Per-pilgrim price by room sharing.</CardDescription>
          </CardHeader>
          <CardContent>
            <PricingManager packageId={pkg.id} rows={pricing.map((p) => ({ ...p, price: Number(p.price) }))} currency={pkg.currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Day-by-day plan</CardTitle>
          <CardDescription>What pilgrims do each day — shown as the itinerary on the package page.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItineraryManager packageId={pkg.id} days={itinerary} durationDays={pkg.duration_days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local agencies</CardTitle>
          <CardDescription>Which partner agencies handle this package on the ground.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgenciesPicker packageId={pkg.id} agencies={agencies} selectedIds={linkedAgencyIds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Departures</CardTitle>
          <CardDescription>Scheduled dates and seat inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeparturesForm packageId={pkg.id} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departure</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Price override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No departures scheduled yet.
                </TableCell>
              </TableRow>
            ) : (
              departures.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{new Date(d.departure_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(d.return_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {d.booked_seats} / {d.total_seats} booked
                  </TableCell>
                  <TableCell>
                    {d.price_override ? `${pkg.currency} ${Number(d.price_override).toFixed(0)}` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
