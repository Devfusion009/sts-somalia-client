import { requirePlatformAdmin } from "@/lib/auth/session";
import { getB2BvsB2C } from "@/modules/admin/queries";
import { resolveDateRange } from "@/lib/date-range";
import { toCsv } from "@/lib/csv";

export async function GET(request: Request) {
  await requirePlatformAdmin();
  const { searchParams } = new URL(request.url);
  const range = resolveDateRange({
    range: searchParams.get("range") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const rows = await getB2BvsB2C(range.from, range.to);
  const csv = toCsv(rows.map((r) => ({ channel: r.label, orders: r.orders, revenue_usd: r.revenue })));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="b2b-vs-b2c-${range.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
