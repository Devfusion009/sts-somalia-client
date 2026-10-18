import "server-only";
import { toCsv } from "@/lib/csv";
import { getGuestDirectory } from "@/modules/hotels/guest-queries";
import { getHotelReport, resolveRange } from "@/modules/hotels/report-queries";

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function guestsCsv(hotelId: string) {
  const guests = await getGuestDirectory(hotelId);
  const csv = toCsv(
    guests.map((g) => ({
      name: g.name,
      phone: g.phone ?? "",
      email: g.email ?? "",
      channel: g.channel,
      stays: g.stays,
      cancelled: g.cancelled,
      no_shows: g.noShows,
      room_nights: g.roomNights,
      total_spent: g.totalSpent.toFixed(2),
      currency: g.currency,
      first_stay: g.firstStay ?? "",
      last_stay: g.lastStay ?? "",
      next_arrival: g.nextArrival ?? "",
    }))
  );
  return csvResponse(csv, `guests-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function reportCsv(hotelId: string, rangeKey: string | undefined) {
  const range = resolveRange(rangeKey);
  const report = await getHotelReport(hotelId, range.from, range.to);
  const csv = toCsv(
    report.byRoom.map((r) => ({
      room_type: r.name,
      from: range.from,
      to: range.to,
      stays: r.stays,
      room_nights: r.roomNights,
      avg_rate: r.adr === null ? "" : r.adr.toFixed(2),
      occupancy_pct: r.occupancyPct === null ? "" : r.occupancyPct,
      revenue: r.revenue.toFixed(2),
      currency: report.currency,
    }))
  );
  return csvResponse(csv, `hotel-report-${range.from}-to-${range.to}.csv`);
}
