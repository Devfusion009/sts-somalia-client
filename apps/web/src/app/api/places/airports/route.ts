import { NextResponse } from "next/server";
import { searchAirports } from "@/modules/flights/airport-search";

/** Public proxy for the flight form's airport picker — keyless lookup, nothing user-specific. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const places = await searchAirports(searchParams.get("input") ?? "");
  return NextResponse.json({ places });
}
