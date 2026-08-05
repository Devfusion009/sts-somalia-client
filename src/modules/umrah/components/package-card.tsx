import Link from "next/link";
import { Landmark, CalendarDays, Users, Clock3, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

export type PackageCardData = {
  id: string;
  slug: string;
  name: string;
  duration_days: number;
  base_price: number;
  currency: string;
  includes: string[];
  nextDeparture: { departure_date: string; total_seats: number; booked_seats: number } | null;
};

export const INCLUDE_LABELS: Record<string, string> = {
  flights: "Flights",
  visa: "Visa",
  hotel: "Hotel",
  transport: "Transport",
  meals: "Meals",
  ziyarat_tours: "Ziyarat",
  private_guide: "Private Guide",
};

/** Tier is presentation-only: inferred from the package name, else price. */
export function packageTier(pkg: { name: string; base_price: number }) {
  const name = pkg.name.toLowerCase();
  if (name.includes("vip")) return { label: "VIP", className: "bg-brand-gold/15 text-brand-gold" };
  if (name.includes("premium"))
    return { label: "Premium", className: "bg-chart-4/10 text-chart-4" };
  if (name.includes("economy"))
    return { label: "Economy", className: "bg-chart-3/10 text-chart-3" };
  if (pkg.base_price >= 2500) return { label: "VIP", className: "bg-brand-gold/15 text-brand-gold" };
  if (pkg.base_price >= 1500)
    return { label: "Premium", className: "bg-chart-4/10 text-chart-4" };
  return { label: "Economy", className: "bg-chart-3/10 text-chart-3" };
}

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  const seatsLeft = pkg.nextDeparture
    ? pkg.nextDeparture.total_seats - pkg.nextDeparture.booked_seats
    : null;
  const tier = packageTier(pkg);

  return (
    <Link href={`/umrah/${pkg.slug}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative">
          <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-40 w-full" />
          <Badge className={cn("absolute top-3 left-3 border-transparent font-semibold", tier.className, "bg-card")}>
            {tier.label}
          </Badge>
          {seatsLeft !== null && seatsLeft <= 10 ? (
            <Badge className="absolute top-3 right-3 gap-1 border-transparent bg-card text-brand-accent">
              <Users className="size-3" />
              {seatsLeft} seats left
            </Badge>
          ) : null}
        </div>
        <CardContent className="flex flex-1 flex-col gap-2.5 p-4">
          <h3 className="font-heading text-base font-bold leading-tight group-hover:text-primary">
            {pkg.name}
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock3 className="size-3.5" /> {pkg.duration_days} days
            </span>
            {pkg.nextDeparture ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                Departs {format(new Date(pkg.nextDeparture.departure_date), "d MMM yyyy")}
              </span>
            ) : null}
          </div>
          {pkg.includes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pkg.includes.slice(0, 4).map((item) => (
                <span
                  key={item}
                  className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground"
                >
                  {INCLUDE_LABELS[item] ?? item}
                </span>
              ))}
              {pkg.includes.length > 4 ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  +{pkg.includes.length - 4} more
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-auto flex items-end justify-between pt-2">
            <p className="text-sm">
              <span className="block text-[10px] text-muted-foreground uppercase">From</span>
              <span className="font-heading text-lg font-bold text-primary">
                {pkg.currency} {pkg.base_price.toFixed(0)}
              </span>{" "}
              <span className="text-xs text-muted-foreground">/ pilgrim</span>
            </p>
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              View package <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
