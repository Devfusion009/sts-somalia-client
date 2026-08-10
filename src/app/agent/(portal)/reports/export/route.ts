import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCommissionEntries } from "@/modules/agencies/queries";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) {
    return new Response("No active agency membership.", { status: 403 });
  }

  const entries = await getAgencyCommissionEntries(membership.agency.id);

  const csv = toCsv(
    entries.map((e) => ({
      order_number: e.order?.order_number ?? "",
      date: new Date(e.created_at).toISOString().slice(0, 10),
      rate_percent: e.rate_applied,
      commission_usd: Number(e.commission_amount).toFixed(2),
      markup_usd: Number(e.markup_amount).toFixed(2),
      total_usd: Number(e.amount).toFixed(2),
      status: e.status,
    }))
  );

  const filename = `commission-report-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
