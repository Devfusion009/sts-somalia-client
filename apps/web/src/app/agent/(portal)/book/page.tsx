import Link from "next/link";
import { Hotel, Landmark, PartyPopper, Plane, Search, Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency, getAgencyCustomersWithStats } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { NewBookingCustomerDialog } from "@/modules/agencies/components/new-booking-customer-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerPickerTable } from "./customer-picker-table";

const SERVICES = [
  { href: "/agent/book/flights", label: "Flights", icon: Plane, tint: "bg-primary/10 text-primary" },
  { href: "/agent/book/hotels", label: "Hotels", icon: Hotel, tint: "bg-chart-2/10 text-chart-2" },
  { href: "/agent/book/umrah", label: "Umrah", icon: Landmark, tint: "bg-chart-4/10 text-chart-4" },
  {
    href: "/agent/book/events",
    label: "Event halls",
    icon: PartyPopper,
    tint: "bg-brand-gold/15 text-brand-gold",
  },
  { href: "/agent/book/visa", label: "Visa", icon: Stamp, tint: "bg-chart-3/10 text-chart-3" },
];

export default async function BookingDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const selected = await getBookingCustomers(supabase, membership.agency.id);

  if (selected.length > 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold">New booking</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="flex items-center gap-3 rounded-lg bg-card px-4 py-4 ring-1 ring-foreground/10 transition-colors hover:bg-secondary/50"
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${service.tint}`}
              >
                <service.icon className="size-5" />
              </span>
              <span className="font-medium">{service.label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const customers = await getAgencyCustomersWithStats(membership.agency.id, q);
  // Without a search, the counter almost always wants someone seen recently.
  const ordered = q
    ? customers
    : [...customers].sort((a, b) => (b.lastBookingAt ?? "").localeCompare(a.lastBookingAt ?? ""));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Who is this booking for?</h1>
        <NewBookingCustomerDialog />
      </div>

      <form className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or phone"
          className="pl-9"
        />
      </form>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {q ? `No customers match “${q}”.` : "No customers yet."}
          </CardContent>
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
    </div>
  );
}
