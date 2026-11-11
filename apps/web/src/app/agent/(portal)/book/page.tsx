import { redirect } from "next/navigation";
import { Search, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency, getAgencyCustomersWithStats } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { getAgentService } from "@/modules/agencies/services";
import { NewBookingCustomerDialog } from "@/modules/agencies/components/new-booking-customer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { CustomerPickerTable } from "./customer-picker-table";
import { ServiceLauncher } from "../service-launcher";
import styles from "../workspace.module.css";

export const metadata = { title: "New booking" };

export default async function BookingDeskPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; service?: string }>;
}) {
  const { q, page: pageParam, service: serviceKey } = await searchParams;
  const service = getAgentService(serviceKey);
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;
  const supabase = await createClient();
  const selected = await getBookingCustomers(supabase, membership.agency.id);
  if (selected.length > 0 && service) redirect(service.href);

  if (selected.length > 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="New booking" />
        <section className={styles.launcher} aria-labelledby="service-picker-title">
          <div className={styles.sectionHead}><h2 id="service-picker-title">Choose a service</h2></div>
          <ServiceLauncher hasCustomer />
        </section>
      </div>
    );
  }

  const page = parsePage(pageParam);
  const { customers: ordered, total } = await getAgencyCustomersWithStats(membership.agency.id, {
    search: q, page, sort: q ? "name" : "recent",
  });
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (service) params.set("service", service.key);
    if (target > 1) params.set("page", String(target));
    return params.size ? `/agent/book?${params}` : "/agent/book";
  };
  if (page > 1 && ordered.length === 0) redirect(hrefFor(1));

  return (
    <div className="space-y-6">
      <PageHeader title="New booking" status={service ? <Badge className="h-7 rounded-lg px-3">{service.label}</Badge> : undefined} actions={<NewBookingCustomerDialog redirectTo={service?.href} />} />
      <section className={`${styles.customerArea} space-y-5`} aria-labelledby="customer-picker-title">
        <div className={styles.sectionHead}>
          <div className="flex items-center gap-3">
            <span className={styles.customerHeadingIcon}><UsersRound className="size-5" aria-hidden="true" /></span>
            <h2 id="customer-picker-title">Select a customer</h2>
          </div>
          <Badge variant="secondary" className="h-6 px-2.5 tabular-nums">{total} customer{total === 1 ? "" : "s"}</Badge>
        </div>
        <form role="search" className={styles.customerSearch}>
          {service ? <input type="hidden" name="service" value={service.key} /> : null}
          <InputGroup className="min-w-0 flex-1 bg-card sm:max-w-96">
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput type="search" name="q" defaultValue={q ?? ""} placeholder="Name or phone" aria-label="Search customers" />
          </InputGroup>
          <Button type="submit" variant="secondary" className="text-accent-foreground">Search</Button>
        </form>
        {ordered.length === 0 ? (
          <Empty><EmptyMedia variant="icon"><UsersRound /></EmptyMedia><EmptyTitle>{q ? `No customers match “${q}”` : "No customers"}</EmptyTitle></Empty>
        ) : (
          <CustomerPickerTable redirectTo={service?.href} continueLabel={service?.action ?? "Choose service"} rows={ordered.map((row) => ({
            id: row.id, full_name: row.full_name, phone: row.phone, email: row.email,
            profile_id: row.profile_id, bookings: row.bookings, lastBookingAt: row.lastBookingAt,
          }))} />
        )}
        <Pager page={page} total={total} hrefFor={hrefFor} />
      </section>
    </div>
  );
}
