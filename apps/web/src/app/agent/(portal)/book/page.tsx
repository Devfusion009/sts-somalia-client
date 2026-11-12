import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BedDouble, Check, PartyPopper, Plane, Search, Stamp, UserPlus, UsersRound } from "lucide-react";
import { UmrahIcon } from "@/components/portal/umrah-icon";
import design from "./booking-desk.module.css";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCustomersWithStats } from "@/modules/agencies/queries";
import { getAgentService } from "@/modules/agencies/services";
import { NewBookingCustomerForm } from "./new-booking-customer-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { CustomerPickerTable } from "./customer-picker-table";
import { ServiceLauncher } from "../service-launcher";

export const metadata = { title: "New booking" };

export default async function BookingDeskPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; service?: string; customer?: string }>;
}) {
  const { q, page: pageParam, service: serviceKey, customer } = await searchParams;
  const service = getAgentService(serviceKey);
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;
  if (!service) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader title="Choose a service" />
        <ServiceLauncher desk />
      </div>
    );
  }

  const ServiceIcon = { flights: Plane, hotels: BedDouble, visa: Stamp, umrah: UmrahIcon, events: PartyPopper }[service.key];
  const customerMode = customer === "new" ? "new" : "existing";
  const heading = (
    <div className={design.customerHeading}>
      <header className={design.headingRow}>
        <div>
          <span className={design.eyebrow}>New booking · Customer</span>
          <h1>Who is travelling?</h1>
        </div>
        <div className={design.selectedService}>
          <span className={design.serviceSymbol}><ServiceIcon aria-hidden="true" /></span>
          <dl><dt>Selected service</dt><dd>{service.label}</dd></dl>
          <Link href="/agent/book" aria-label={`Change service from ${service.label}`}><ArrowLeft className="size-3.5" aria-hidden="true" />Change</Link>
        </div>
      </header>
      <nav className={design.customerChoices} aria-label="Customer options">
        <Link href={`/agent/book?service=${service.key}`} aria-current={customerMode === "existing" ? "page" : undefined}>
          <span className={design.choiceIcon}><UsersRound aria-hidden="true" /></span>
          <span>Existing customer</span>
          {customerMode === "existing" ? <Check className={design.choiceMark} aria-hidden="true" /> : <ArrowRight className={design.choiceMark} aria-hidden="true" />}
        </Link>
        <Link href={`/agent/book?service=${service.key}&customer=new`} aria-current={customerMode === "new" ? "page" : undefined}>
          <span className={design.choiceIcon}><UserPlus aria-hidden="true" /></span>
          <span>New customer</span>
          {customerMode === "new" ? <Check className={design.choiceMark} aria-hidden="true" /> : <ArrowRight className={design.choiceMark} aria-hidden="true" />}
        </Link>
      </nav>
    </div>
  );
  if (customerMode === "new") return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {heading}
      <NewBookingCustomerForm redirectTo={service.href} cancelHref={`/agent/book?service=${service.key}`} />
    </div>
  );

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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {heading}
      <section className={design.directory} aria-labelledby="customer-picker-title">
        <div className={design.directoryHeading}>
          <h2 id="customer-picker-title">Select a customer</h2>
          <Badge variant="secondary" className="tabular-nums">{total} customer{total === 1 ? "" : "s"}</Badge>
        </div>
        <form role="search" className={design.searchArea}>
          {service ? <input type="hidden" name="service" value={service.key} /> : null}
          <InputGroup className={design.searchInput}>
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput type="search" name="q" defaultValue={q ?? ""} placeholder="Search by customer name or phone" aria-label="Search customers" />
          </InputGroup>
          <Button type="submit" className={design.searchButton}>Search<ArrowRight className="size-4" aria-hidden="true" /></Button>
        </form>
        {ordered.length === 0 ? (
          <Empty><EmptyMedia variant="icon"><UsersRound /></EmptyMedia><EmptyTitle>{q ? `No customers match “${q}”` : "No customers"}</EmptyTitle><Button render={<Link href={`/agent/book?service=${service.key}&customer=new`} />}>Add new customer</Button></Empty>
        ) : (
          <CustomerPickerTable redirectTo={service?.href} continueLabel="Continue" rows={ordered.map((row) => ({
            id: row.id, full_name: row.full_name, phone: row.phone, email: row.email,
            profile_id: row.profile_id, bookings: row.bookings, lastBookingAt: row.lastBookingAt,
          }))} />
        )}
        <Pager page={page} total={total} hrefFor={hrefFor} />
      </section>
    </div>
  );
}
