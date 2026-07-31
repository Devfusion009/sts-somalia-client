import Link from "next/link";
import { Landmark, CalendarDays, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/media-placeholder";

export type PackageCardData = {
  id: string;
  slug: string;
  name: string;
  duration_days: number;
  base_price: number;
  currency: string;
  nextDeparture: { departure_date: string; total_seats: number; booked_seats: number } | null;
};

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  const seatsLeft = pkg.nextDeparture ? pkg.nextDeparture.total_seats - pkg.nextDeparture.booked_seats : null;

  return (
    <Link href={`/umrah/${pkg.slug}`} className="group block">
      <Card className="overflow-hidden py-0 transition-shadow hover:shadow-lg">
        <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-40 w-full" />
        <CardContent className="space-y-2 p-4">
          <h3 className="font-heading text-lg font-semibold leading-tight group-hover:text-primary">
            {pkg.name}
          </h3>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {pkg.duration_days} days
            {pkg.nextDeparture ? ` · departs ${new Date(pkg.nextDeparture.departure_date).toLocaleDateString()}` : ""}
          </p>
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm">
              <span className="font-semibold text-foreground">
                {pkg.currency} {pkg.base_price.toFixed(0)}
              </span>{" "}
              <span className="text-muted-foreground">/ person</span>
            </p>
            {seatsLeft !== null && seatsLeft <= 10 ? (
              <Badge variant="secondary" className="gap-1 text-brand-accent">
                <Users className="size-3" />
                {seatsLeft} seats left
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
