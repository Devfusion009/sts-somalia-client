import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyWalletLedger } from "@/modules/agencies/queries";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) {
    return new Response("No active agency membership.", { status: 403 });
  }

  const ledger = await getAgencyWalletLedger(membership.agency.id);

  const csv = toCsv(
    ledger.map((tx) => ({
      date: new Date(tx.created_at).toISOString().slice(0, 10),
      type: tx.type,
      document_number: tx.document_number ?? "",
      order_number: tx.order?.order_number ?? "",
      note: tx.note ?? "",
      amount_usd: Number(tx.amount).toFixed(2),
      balance_after_usd: Number(tx.balance_after).toFixed(2),
    }))
  );

  const filename = `wallet-statement-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
