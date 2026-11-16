import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAdminFlights } from "@/modules/flights/admin-list";
const cell = (value: unknown) => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
export async function GET(request: NextRequest) {
  await requirePlatformAdmin();
  const filters = Object.fromEntries(request.nextUrl.searchParams);
  const lines = [["Booking ID","Origin","Destination","Departure","Return","Source","Status","PNR","Fare","Currency","Created"].map(cell).join(",")];
  for(let offset=0;;offset+=500) {
    const {data} = await getAdminFlights(filters,offset,500);
    for(const b of data ?? []) lines.push([b.id,b.origin_iata,b.destination_iata,b.depart_at,b.return_at,b.agency_id ? "B2B":"B2C",b.ticketing_status ?? b.status,b.provider_booking_ref,b.total_price,b.currency,b.created_at].map(cell).join(","));
    if(!data || data.length<500) break;
  }
  return new Response("\uFEFF"+lines.join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=flight-bookings.csv","Cache-Control":"no-store"}});
}
