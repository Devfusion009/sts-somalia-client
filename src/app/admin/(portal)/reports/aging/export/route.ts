import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAgencyAgingReport } from "@/modules/agencies/queries";
import { toCsv } from "@/lib/csv";

export async function GET() {
  await requirePlatformAdmin();
  const rows = await getAgencyAgingReport();

  const csv = toCsv(
    rows.map((r) => ({
      agency: r.agencyName,
      email: r.contactEmail,
      outstanding_usd: r.outstandingAmount.toFixed(2),
      aging_since: new Date(r.agingSince).toISOString().slice(0, 10),
      aging_days: r.agingDays,
      bucket: r.bucket,
    }))
  );

  const filename = `aging-report-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
