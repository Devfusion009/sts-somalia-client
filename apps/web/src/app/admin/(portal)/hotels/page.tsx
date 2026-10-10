import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
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

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "suspended", label: "Suspended" },
] as const;

export default async function AdminHotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const status = STATUS_OPTIONS.find((o) => o.value === sp.status)?.value;
  const [{ rows: hotels, total }, partners] = await Promise.all([
    getHotelsAdmin({ page, q: sp.q, status }),
    getHotelPartnersForSelect(),
  ]);
  const hrefFor = (n: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (status) params.set("status", status);
    params.set("page", String(n));
    return `/hotels?${params.toString()}`;
  };

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

      <form action="/admin/hotels" className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q} placeholder="Hotel or city" className="h-8 w-64 pl-8" aria-label="Search" />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Status"
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>

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
                  {sp.q || status ? "No hotels match." : "No hotels yet — add your first property."}
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
                  <TableCell>{hotel.hotel_rooms?.[0]?.count ?? 0}</TableCell>
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

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
