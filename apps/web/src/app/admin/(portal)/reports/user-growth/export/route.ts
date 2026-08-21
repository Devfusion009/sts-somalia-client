import { requirePlatformAdmin } from "@/lib/auth/session";
import { getUserGrowth } from "@/modules/admin/queries";
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

  const rows = await getUserGrowth(range.from, range.to, range.granularity);
  const csv = toCsv(rows.map((r) => ({ period: r.label, total_users: r.total })));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="user-growth-${range.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
