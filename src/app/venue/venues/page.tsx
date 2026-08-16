import { requireUser } from "@/lib/auth/session";
import { getMyVenuePartnerId, getMyVenues } from "@/modules/events/venue-partner-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VenuePartnerForm, type EditableVenue } from "./venue-partner-form";

export const metadata = { title: "My Venues" };

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  published: "bg-primary/10 text-primary",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function MyVenuesPage() {
  const profile = await requireUser();
  const partnerId = (await getMyVenuePartnerId(profile.id))!;
  const venues = await getMyVenues(partnerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">My Venues</h1>
          <p className="text-sm text-muted-foreground">
            Draft your listing, submit it for review, and STS staff publish it to the public catalog.
          </p>
        </div>
        <VenuePartnerForm />
      </div>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No venues yet — add your first venue to get started.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.map((venue) => (
                <TableRow key={venue.id}>
                  <TableCell>
                    <p className="font-medium">{venue.name}</p>
                    {venue.tagline ? <p className="text-xs text-muted-foreground">{venue.tagline}</p> : null}
                  </TableCell>
                  <TableCell>{venue.city}</TableCell>
                  <TableCell className="text-sm">
                    {venue.capacity_seated ? `${venue.capacity_seated} seated` : ""}
                    {venue.capacity_seated && venue.capacity_standing ? " · " : ""}
                    {venue.capacity_standing ? `${venue.capacity_standing} standing` : ""}
                  </TableCell>
                  <TableCell className="text-sm">
                    {venue.currency} {Number(venue.base_price).toFixed(0)}{" "}
                    <span className="text-xs text-muted-foreground">/ {venue.price_unit.replace("per_", "")}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-transparent capitalize ${STATUS_BADGE[venue.status] ?? ""}`}>
                      {venue.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <VenuePartnerForm venue={venue as unknown as EditableVenue} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
