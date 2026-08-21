import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCommissionEntries } from "@/modules/agencies/queries";
import { renderCommissionStatementPdf } from "@/modules/agencies/pdf/render";
import type { Database } from "@/lib/types/database.types";

const ITEM_TYPES = new Set<Database["public"]["Enums"]["order_item_type"]>([
  "hotel",
  "flight",
  "visa",
  "umrah",
  "hall",
]);

function parseItemType(value: string | null) {
  return value && ITEM_TYPES.has(value as Database["public"]["Enums"]["order_item_type"])
    ? (value as Database["public"]["Enums"]["order_item_type"])
    : undefined;
}

export async function GET(request: Request) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) {
    return new Response("No active agency membership.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const itemType = parseItemType(searchParams.get("type"));

  const entries = await getAgencyCommissionEntries(membership.agency.id, { from, to, itemType });
  const periodLabel =
    from || to ? `${from ?? "start"} — ${to ?? "now"}` : "All time";

  const pdfBuffer = await renderCommissionStatementPdf({
    agencyName: membership.agency.name,
    periodLabel,
    entries,
  });

  const filename = `commission-statement-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
