import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readinessLabel } from "@/modules/umrah/readiness";

/**
 * Departure manifest or rooming list as CSV, for staff only. Holds passport
 * data, so it is never cached and never served without a platform admin
 * session; umrah_departure_manifest checks is_admin() again in SQL.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value) ? value.join("; ") : String(value);
  // Spreadsheet formula injection: a cell starting with = + - @ is data, not a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function GET(request: Request, { params }: { params: Promise<{ departureId: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { departureId } = await params;
  if (!z.string().uuid().safeParse(departureId).success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const kind = new URL(request.url).searchParams.get("kind") === "rooming" ? "rooming" : "manifest";

  const supabase = await createClient();
  const [{ data: departure }, { data: manifest, error }] = await Promise.all([
    supabase.from("umrah_package_departures").select("departure_date").eq("id", departureId).maybeSingle(),
    supabase.rpc("umrah_departure_manifest", { p_departure_id: departureId }),
  ]);
  if (error || !departure) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const rows = manifest ?? [];

  const csv =
    kind === "manifest"
      ? toCsv([
          [
            "Order", "Order status", "Guest", "Agency", "Pilgrim", "Gender", "Date of birth", "Nationality",
            "Passport", "Passport expiry", "Mahram", "Phone", "Stage", "Paid", "Balance", "Currency",
            "Room Makkah", "Room Madinah", "Missing", "Warnings",
          ],
          ...rows.map((m) => [
            m.order_number, m.order_status, m.guest_name ?? m.customer_name, m.agency_name, m.full_name, m.gender,
            m.date_of_birth, m.nationality, m.passport_number, m.passport_expiry, m.mahram_name, m.phone ?? m.customer_phone,
            m.fulfillment_stage, m.paid, m.balance, m.currency, m.room_makkah, m.room_madinah,
            m.missing.map(readinessLabel), m.warnings.map(readinessLabel),
          ]),
        ])
      : toCsv([
          ["City", "Room", "Pilgrim", "Gender", "Guest", "Order", "Room sharing"],
          ...(["makkah", "madinah"] as const).flatMap((city) =>
            [...rows]
              .sort((a, b) =>
                String(city === "makkah" ? a.room_makkah : a.room_madinah).localeCompare(
                  String(city === "makkah" ? b.room_makkah : b.room_madinah),
                  undefined,
                  { numeric: true }
                )
              )
              .map((m) => [
                city === "makkah" ? "Makkah" : "Madinah",
                (city === "makkah" ? m.room_makkah : m.room_madinah) ?? "",
                m.full_name,
                m.gender,
                m.guest_name ?? m.customer_name,
                m.order_number,
                m.room_sharing,
              ])
          ),
        ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="umrah-${kind}-${departure.departure_date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
