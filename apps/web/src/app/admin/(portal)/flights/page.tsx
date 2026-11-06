import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Inbox } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { getFlightQuoteRequests, type FlightQuoteRequest } from "@/modules/flights/admin-quotes";
import { FlightQuoteForm, FlightTicketForm } from "./quote-actions";

export const metadata = { title: "Flight Requests" };

const CABIN: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
};

function day(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

type Stage = "new" | "quoted" | "paid" | "ticketed" | "closed";

function stageOf(r: FlightQuoteRequest): Stage {
  if (r.status === "confirmed" || r.status === "completed") return "ticketed";
  if (r.status !== "pending") return "closed";
  if (!r.order) return "new";
  return ["paid", "processing", "completed"].includes(r.order.status) ? "paid" : "quoted";
}

const STAGE_LABEL: Record<Stage, string> = {
  new: "New request",
  quoted: "Quoted",
  paid: "Paid · ticket due",
  ticketed: "Ticketed",
  closed: "Closed",
};

const FILTERS: { key: string; label: string; stages: Stage[] | null }[] = [
  { key: "open", label: "Open", stages: ["new", "quoted", "paid"] },
  { key: "new", label: "New", stages: ["new"] },
  { key: "quoted", label: "Awaiting payment", stages: ["quoted"] },
  { key: "paid", label: "Ticket due", stages: ["paid"] },
  { key: "all", label: "All", stages: null },
];

export default async function AdminFlightRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requirePlatformAdmin();
  const { view } = await searchParams;
  const requests = await getFlightQuoteRequests();
  const withStage = requests.map((r) => ({ ...r, stage: stageOf(r) }));
  const filter = FILTERS.find((f) => f.key === view) ?? FILTERS[0];
  const shown = filter.stages ? withStage.filter((r) => filter.stages!.includes(r.stage)) : withStage;
  const waiting = withStage.filter((r) => r.stage === "new" || r.stage === "paid").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flight requests"
        status={
          waiting > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {waiting} waiting
            </Badge>
          ) : null
        }
      />

      <FilterChips
        label="Filter flight requests"
        active={filter.key}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "open" ? "/admin/flights" : `/admin/flights?view=${f.key}`,
          count: f.stages ? withStage.filter((r) => f.stages!.includes(r.stage)).length : withStage.length,
        }))}
      />

      {shown.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>No flight requests</EmptyTitle>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => {
            const customer = Array.isArray(r.customer) ? r.customer[0] : r.customer;
            const agency = Array.isArray(r.agency) ? r.agency[0] : r.agency;
            const traveller = Array.isArray(r.agency_customer) ? r.agency_customer[0] : r.agency_customer;
            const price = Number(r.total_price) > 0 ? Number(r.total_price) : null;
            const depart = day(r.depart_at);
            const ret = r.trip_type === "round_trip" ? day(r.return_at) : null;
            const name = traveller?.full_name ?? customer?.full_name ?? customer?.email ?? "Customer";
            const phone = r.contactPhone ?? traveller?.phone ?? customer?.phone ?? null;

            return (
              <Card key={r.id} className="gap-0 overflow-hidden py-0">
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="font-mono text-sm">
                          {r.origin_iata} → {r.destination_iata}
                        </span>
                        <Badge
                          variant={r.stage === "new" || r.stage === "paid" ? "warning" : statusBadgeVariant(r.status)}
                        >
                          {STAGE_LABEL[r.stage]}
                        </Badge>
                        {agency?.name ? <Badge variant="neutral">{agency.name}</Badge> : null}
                        {r.provider_booking_ref ? (
                          <span className="font-mono text-xs text-muted-foreground">PNR {r.provider_booking_ref}</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {depart}
                        {ret ? ` – ${ret}` : " · one way"} · {r.passengers} passenger{r.passengers > 1 ? "s" : ""} ·{" "}
                        {CABIN[r.cabin_class] ?? r.cabin_class}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {name}
                        {phone ? (
                          <>
                            {" · "}
                            <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-foreground">
                              {phone}
                            </a>
                          </>
                        ) : null}
                        {" · "}
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <p className="font-heading text-xl font-semibold tabular-nums">
                        {price ? money(price, r.currency) : "—"}
                      </p>
                      {r.order ? (
                        <Link
                          href={`/admin/orders?order=${r.order.id}`}
                          className="font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                          {r.order.order_number} · {r.order.status.replace(/_/g, " ")}
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {r.notes || r.quote?.airline ? (
                    <div className="flex flex-wrap gap-2 text-sm">
                      {r.notes ? (
                        <p className="rounded-lg bg-secondary/40 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Traveller · </span>
                          {r.notes}
                        </p>
                      ) : null}
                      {r.quote?.airline ? (
                        <p className="rounded-lg bg-secondary/40 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Quoted · </span>
                          {r.quote.airline}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {r.stage === "new" || r.stage === "quoted" ? (
                    <FlightQuoteForm
                      bookingId={r.id}
                      currency={r.currency}
                      price={price}
                      airline={r.quote?.airline ?? null}
                      quoted={r.stage === "quoted"}
                    />
                  ) : r.stage === "paid" ? (
                    <FlightTicketForm bookingId={r.id} />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
