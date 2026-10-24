import { PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyVenuePartnerId, getMyVenues } from "@/modules/events/venue-partner-queries";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getManagersForVenues } from "@/modules/events/venue-manager-queries";
import { VenuePartnerForm, type EditableVenue } from "./venue-partner-form";
import { VenueManagersDialog } from "./venue-managers-dialog";
import { priceUnitLabel, venueMoney } from "@/modules/events/components/amenities";

export const metadata = { title: "My Venues" };

export default async function MyVenuesPage() {
  const profile = await requireUser();
  const partnerId = (await getMyVenuePartnerId(profile.id))!;
  const venues = await getMyVenues(partnerId);
  const managers = await getManagersForVenues(venues.map((v) => v.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Venues"
        status={
          venues.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {venues.length}
            </Badge>
          ) : null
        }
        actions={<VenuePartnerForm />}
      />

      {venues.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <PartyPopper />
            </EmptyMedia>
            <EmptyTitle>No venues</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>City</TableHead>
                <TableHead numeric>Seated</TableHead>
                <TableHead numeric>Standing</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.map((venue) => (
                <TableRow key={venue.id}>
                  <TableCell className="max-w-64">
                    <p className="truncate font-medium">{venue.name}</p>
                    {venue.tagline ? <p className="truncate text-xs text-muted-foreground">{venue.tagline}</p> : null}
                  </TableCell>
                  <TableCell>{venue.city}</TableCell>
                  <TableCell numeric>{venue.capacity_seated ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell numeric>{venue.capacity_standing ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell numeric className="whitespace-nowrap">
                    {venueMoney(venue.currency, venue.base_price)}
                    <p className="text-xs text-muted-foreground">{priceUnitLabel(venue.price_unit)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(venue.status)} className="capitalize">
                      {venue.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <VenueManagersDialog venueId={venue.id} venueName={venue.name} managers={managers.get(venue.id) ?? []} />
                      <VenuePartnerForm venue={venue as unknown as EditableVenue} />
                    </div>
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
