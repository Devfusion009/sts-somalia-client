import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { AgentMoney } from "@/components/portal/agent-money";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { money } from "@/lib/money";
import { BOOKING_STATUS_LABELS } from "@/modules/agencies/booking-filters";
import type { getAgencyOrders } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/orders/format";
import { SERVICE_STYLE } from "./service-palette";

type AgencyOrder = Awaited<ReturnType<typeof getAgencyOrders>>["orders"][number];

export function RecentBookings({ orders }: { orders: AgencyOrder[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="recent-bookings-title">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 id="recent-bookings-title" className="font-heading text-base font-semibold">Recent bookings</h2>
        <Link href="/agent/bookings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">View all<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
      </div>
      {orders.length === 0 ? (
        <Empty className="border-t border-border">
          <EmptyMedia variant="icon"><Ticket /></EmptyMedia>
          <EmptyTitle>No bookings yet</EmptyTitle>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">Reference</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Details</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => {
                const item = order.order_items[0];
                const service = item ? SERVICE_STYLE[item.item_type] : null;
                const Icon = service?.icon ?? Ticket;
                const extra = order.order_items.length - 1;
                const awaitingPrice = Number(order.total) === 0 && ["pending_payment", "held", "partially_paid"].includes(order.status);
                return (
                  <tr key={order.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium tabular-nums"><Link href={`/agent/bookings/${order.id}`} className="hover:text-primary hover:underline">{order.order_number}</Link></td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: service?.color ?? "var(--muted-foreground)" }}><Icon className="size-3.5" aria-hidden="true" /></span>
                        {service?.label ?? "Booking"}
                      </span>
                    </td>
                    <td className="max-w-40 truncate px-3 py-3">{order.agency_customer?.full_name ?? <span className="text-muted-foreground">Self</span>}</td>
                    <td className="max-w-56 truncate px-3 py-3 text-muted-foreground">{item ? describeOrderItem(item).title : "—"}{extra > 0 ? ` +${extra}` : ""}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{awaitingPrice ? <span className="font-normal text-muted-foreground">On request</span> : <AgentMoney value={money(order.total, order.currency)} />}</td>
                    <td className="px-5 py-3"><Badge variant={awaitingPrice ? "warning" : statusBadgeVariant(order.status)}>{awaitingPrice ? "Awaiting price" : BOOKING_STATUS_LABELS[order.status]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
