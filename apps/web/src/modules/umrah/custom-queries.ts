import "server-only";
import type { UmrahService } from "@sts/shared-types";
import { getServerTrpc } from "@/lib/trpc/server";
import type { SharingPriceMap } from "@/modules/umrah/pricing";

/** The published private-trip catalog, in display order. */
export async function getUmrahServices(): Promise<UmrahService[]> {
  const trpc = await getServerTrpc();
  return trpc.umrah.services.query();
}

/** Occupancy prices for published hotel services, keyed by service id. */
export async function getUmrahSharingPrices(): Promise<SharingPriceMap> {
  const trpc = await getServerTrpc();
  return (await trpc.umrah.sharingPrices.query()) as SharingPriceMap;
}

/** Every service including drafts — the admin catalog screen. */
export async function getUmrahServicesAdmin() {
  const trpc = await getServerTrpc();
  return trpc.umrah.admin.services.list.query();
}

export type UmrahCustomRequest = NonNullable<Awaited<ReturnType<typeof getUmrahCustomRequest>>>;

/** One request — the owner, its agency, or an admin. */
export async function getUmrahCustomRequest(requestId: string) {
  const trpc = await getServerTrpc();
  return trpc.umrah.trip.get.query({ requestId });
}

/** Submitted private requests awaiting a decision, newest first. */
export async function getSubmittedUmrahRequests() {
  const trpc = await getServerTrpc();
  return trpc.umrah.admin.requests.list.query();
}

/** The signed-in customer's most recent unfinished build, if any. */
export async function getMyDraftUmrahRequest() {
  const trpc = await getServerTrpc();
  return trpc.umrah.trip.myDraft.query();
}
