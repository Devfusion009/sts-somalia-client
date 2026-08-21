import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHotelsAdmin, getHotelPartnersForSelect } from "@/modules/admin/queries";
import { HotelForm } from "./hotel-form";
import { OnboardPartnerDialog } from "./onboard-partner-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hotels" };

const HOTEL_STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function AdminHotelsPage() {
  const [hotels, partners] = await Promise.all([getHotelsAdmin(), getHotelPartnersForSelect()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Hotels</h1>
        </div>
        <div className="flex gap-2">
          <OnboardPartnerDialog />
          <HotelForm partners={partners} />
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Stars</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hotels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No hotels yet — add your first property.
                </TableCell>
              </TableRow>
            ) : (
              hotels.map((hotel) => (
                <TableRow key={hotel.id}>
                  <TableCell>
                    <Link href={`/admin/hotels/${hotel.id}`} className="font-medium hover:underline">
                      {hotel.name}
                    </Link>
                    <p className="text-xs text-muted-foreground capitalize">{hotel.booking_mode} booking</p>
                  </TableCell>
                  <TableCell>{hotel.city}</TableCell>
                  <TableCell>{hotel.star_rating ? `${hotel.star_rating}★` : "—"}</TableCell>
                  <TableCell>{hotel.hotel_rooms?.length ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {hotel.partner?.name ?? "STS (direct)"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        HOTEL_STATUS_STYLES[hotel.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {hotel.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="gap-1.5" render={<Link href={`/admin/hotels/${hotel.id}`} />}>
                      Manage <ArrowRight className="size-3.5" />
                    </Button>
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
