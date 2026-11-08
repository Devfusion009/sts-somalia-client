import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAgentLeaderboard } from "@/modules/admin/queries";
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

  const rows = await getAgentLeaderboard(range.from, range.to, 50);
  const csv = toCsv(rows.map((r, i) => ({ rank: i + 1, agency: r.name, orders: r.orders, revenue_usd: r.revenue })), ["rank", "agency", "orders", "revenue_usd"]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="agent-leaderboard-${range.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
