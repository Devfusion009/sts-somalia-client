import Link from "next/link";
import { ChevronRight, Hotel, Landmark, PartyPopper, Plane, Search, Stamp, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency, getAgencyCustomersWithStats } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { NewBookingCustomerDialog } from "@/modules/agencies/components/new-booking-customer-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { CustomerPickerTable } from "./customer-picker-table";

export const metadata = { title: "New booking" };

const SERVICES = [
  { href: "/agent/book/flights", label: "Flights", icon: Plane },
  { href: "/agent/book/hotels", label: "Hotels", icon: Hotel },
  { href: "/agent/book/umrah", label: "Umrah", icon: Landmark },
  { href: "/agent/book/events", label: "Event halls", icon: PartyPopper },
  { href: "/agent/book/visa", label: "Visa", icon: Stamp },
];

export default async function BookingDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const selected = await getBookingCustomers(supabase, membership.agency.id);

  if (selected.length > 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Choose a service" />
        <nav aria-label="Services" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="group flex min-h-16 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-xs ring-1 ring-foreground/[0.08] transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
              >
                <service.icon className="size-5" />
              </span>
              <span className="flex-1 font-medium">{service.label}</span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  const page = parsePage(pageParam);
  // Without a search, the counter almost always wants someone seen recently.
  const { customers: ordered, total } = await getAgencyCustomersWithStats(membership.agency.id, {
    search: q,
    page,
    sort: q ? "name" : "recent",
  });
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/agent/book?${qs}` : "/agent/book";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Who is this booking for?" actions={<NewBookingCustomerDialog />} />

      <form role="search" className="flex items-center gap-2">
        <InputGroup className="sm:w-72 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name or phone"
            aria-label="Search customers"
          />
        </InputGroup>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {ordered.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>{q ? `No customers match “${q}”` : "No customers"}</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <CustomerPickerTable
          rows={ordered.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            phone: row.phone,
            email: row.email,
            profile_id: row.profile_id,
            bookings: row.bookings,
            lastBookingAt: row.lastBookingAt,
          }))}
        />
      )}

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
