import { NextResponse } from "next/server";
import { searchLocations } from "@/lib/provider-runtime/location-search";

/**
 * Server-side proxy for city/place autocomplete — see
 * src/lib/provider-runtime/location-search.ts for provider selection.
 * Deliberately public (no requireUser()): the public hotel search on the
 * homepage and /hotels is the primary consumer, and it's used by anonymous
 * visitors who haven't logged in yet. This only proxies a free/keyless
 * geocoding lookup — no sensitive data, nothing user-specific.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input")?.trim() ?? "";

  const result = await searchLocations(input);
  return NextResponse.json(result);
}
