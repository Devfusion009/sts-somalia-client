import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { getAgencyLedger, ledgerTotals, type LedgerGroup } from "@/modules/agencies/ledger";
import { toCsv } from "@/lib/csv";

const GROUPS = new Set<LedgerGroup>(["earning", "withdrawal", "wallet"]);

/**
 * Exports exactly what the Transactions page is showing — same filters, same
 * rows, same order — as a real .xlsx (or .csv). An export that silently
 * covered a different set than the screen would be worse than none.
 */
export async function GET(request: Request) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) {
    return new Response("No active agency membership.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const groupParam = params.get("group") as LedgerGroup | null;
  const group = groupParam && GROUPS.has(groupParam) ? groupParam : undefined;

  const year = new Date().getFullYear();
  const period = params.get("period");
  const range =
    period === "this-year"
      ? { from: `${year}-01-01`, to: `${year}-12-31` }
      : period === "last-year"
        ? { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
        : {};

  const rows = await getAgencyLedger(membership.agency.id, { group, ...range });
  const totals = ledgerTotals(rows);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `transactions-${stamp}`;

  if (params.get("format") === "csv") {
    const csv = toCsv(
      rows.map((row) => ({
        date: row.createdAt.slice(0, 10),
        type: row.type,
        details: row.detail,
        reference: row.reference ?? "",
        customer: row.customer ?? "",
        status: row.status ?? "",
        amount_usd: row.amount.toFixed(2),
        balance_usd: row.balanceAfter === null ? "" : row.balanceAfter.toFixed(2),
      }))
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "STS Somalia";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Transactions");

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 18 },
    { header: "Details", key: "detail", width: 46 },
    { header: "Reference", key: "reference", width: 20 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Status", key: "status", width: 14 },
    { header: "Amount (USD)", key: "amount", width: 16 },
    { header: "Balance (USD)", key: "balance", width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    sheet.addRow({
      date: new Date(row.createdAt),
      type: row.type,
      detail: row.detail,
      reference: row.reference ?? "",
      customer: row.customer ?? "",
      status: row.status ?? "",
      amount: row.amount,
      balance: row.balanceAfter,
    });
  }

  sheet.getColumn("date").numFmt = "dd mmm yyyy";
  sheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
  sheet.getColumn("balance").numFmt = "#,##0.00";

  sheet.addRow({});
  const totalsRow = sheet.addRow({
    type: "Totals",
    detail: `${totals.count} transactions`,
    status: "Money in",
    amount: totals.moneyIn,
  });
  totalsRow.font = { bold: true };
  const outRow = sheet.addRow({ status: "Money out", amount: -totals.moneyOut });
  outRow.font = { bold: true };
  const netRow = sheet.addRow({ status: "Net", amount: totals.net });
  netRow.font = { bold: true };
  if (totals.inFlight > 0) {
    sheet.addRow({ status: "In flight", amount: -totals.inFlight });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
