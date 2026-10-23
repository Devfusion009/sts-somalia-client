import "server-only";
import { getServerTrpc } from "@/lib/trpc/server";

/** Departures from `from` on, aggregated in SQL (seats, readiness, money owed). */
export async function getDeparturesOverview(from: string) {
  const trpc = await getServerTrpc();
  return trpc.umrah.admin.departures.overview.query({ from });
}

export async function getDepartureAdmin(departureId: string) {
  const trpc = await getServerTrpc();
  try {
    return await trpc.umrah.admin.departures.detail.query({ departureId });
  } catch {
    return null;
  }
}
