import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
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
import { cn } from "@/lib/utils";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export const metadata: Metadata = { title: "Hotels" };

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "suspended", label: "Suspended" },
] as const;

const selectClass = cn(NATIVE_SELECT_CLASS, "w-auto");

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
      <PageHeader
        title="Hotels"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {total.toLocaleString("en-US")}
          </Badge>
        }
        actions={<HotelForm partners={partners} />}
      />

      <form action="/admin/hotels" role="search" className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput name="q" type="search" defaultValue={sp.q} placeholder="Hotel or city" aria-label="Search hotels" />
        </InputGroup>
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={selectClass}>
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="max-sm:h-10">
          Apply
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        {hotels.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>{sp.q || status ? "No hotels match these filters" : "No hotels"}</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>City</TableHead>
                <TableHead numeric>Stars</TableHead>
                <TableHead numeric>Rooms</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotels.map((hotel) => (
                <TableRow key={hotel.id}>
                  <TableCell>
                    <Link
                      href={`/admin/hotels/${hotel.id}`}
                      className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {hotel.name}
                    </Link>
                  </TableCell>
                  <TableCell>{hotel.city}</TableCell>
                  <TableCell numeric>{hotel.star_rating ? `${hotel.star_rating}★` : "—"}</TableCell>
                  <TableCell numeric>{hotel.hotel_rooms?.[0]?.count ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">{hotel.partner?.name ?? "STS (direct)"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(hotel.status)} className="capitalize">
                      {hotel.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Manage ${hotel.name}`}
                      render={<Link href={`/admin/hotels/${hotel.id}`} />}
                    >
                      <ChevronRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
