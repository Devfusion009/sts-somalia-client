import { requireUserForPortal } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrders } from "@/modules/agencies/queries";
import { parseBookingFilters, BOOKING_STATUS_LABELS } from "@/modules/agencies/booking-filters";
import { describeOrderItem } from "@/modules/orders/format";
import { toCsv } from "@/lib/csv";

const COLUMNS = ["order", "booked_at", "customer", "phone", "products", "booking", "status", "total", "paid", "balance_due", "currency"];
// Spreadsheet programs must treat customer input as text, including phone numbers.
const cell = (value: string) => /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;

export async function GET(request: Request) {
  const profile = await requireUserForPortal("agent");
  const membership = await getMyAgency(profile.id);
  if (!membership || membership.agency.status === "suspended") {
    return new Response("No active agency membership.", { status: 403 });
  }
  const filters = parseBookingFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows: Record<string, string | number>[] = [];
  const batchSize = 500;
  // Read every matching page; exports must not stop at the visible page or DB row limit.
  for (let page = 1; ; page++) {
    const { orders } = await getAgencyOrders(membership.agency.id, { ...filters, page }, batchSize);
    for (const order of orders) {
      const paid = order.payments.filter((payment) => payment.status === "succeeded").reduce((sum, payment) => sum + Number(payment.amount), 0);
      const payable = ["held", "pending_payment", "partially_paid"].includes(order.status);
      const awaitingPrice = payable && Number(order.total) === 0;
      rows.push({
        order: cell(order.order_number), booked_at: order.created_at,
        customer: cell(order.agency_customer?.full_name ?? ""), phone: cell(order.agency_customer?.phone ?? ""),
        products: [...new Set(order.order_items.map((item) => item.item_type))].join(" / "),
        booking: cell(order.order_items.map((item) => describeOrderItem(item).title).join(" / ")),
        status: awaitingPrice ? "Awaiting price" : BOOKING_STATUS_LABELS[order.status],
        total: awaitingPrice ? "" : Number(order.total).toFixed(2), paid: paid.toFixed(2),
        balance_due: payable && !awaitingPrice ? Math.max(Number(order.total) - paid, 0).toFixed(2) : "",
        currency: order.currency,
      });
    }
    if (orders.length < batchSize) break;
  }
  return new Response(`\uFEFF${toCsv(rows, COLUMNS)}`, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    "Cache-Control": "private, no-store",
    "Vary": "Cookie",
  } });
}
