import "server-only";
import type { PackageCard } from "@sts/shared-types";
import { getServerTrpc } from "@/lib/trpc/server";
import type { PackageCardData } from "@/modules/umrah/components/package-card";
import { umrahImageUrls } from "@/modules/umrah/images";
import { cache } from "react";

export { bookableDepartures } from "@sts/shared-types";

/** Card DTO from the API with image paths resolved to URLs for <img>. */
function toCardData(card: PackageCard): PackageCardData {
  return { ...card, images: umrahImageUrls(card.images) };
}

/** Landing band: featured first, then cheapest. Failures remain distinct from an empty catalog. */
export async function getFeaturedPackages(limit = 4): Promise<PackageCardData[]> {
  const trpc = await getServerTrpc();
  return (await trpc.umrah.featured.query({ limit })).filter((p) => p.package_type === "group").map(toCardData);
}

export async function getAllPackages(): Promise<PackageCardData[]> {
  const trpc = await getServerTrpc();
  return (await trpc.umrah.packages.query()).filter((p) => p.package_type === "group").map(toCardData);
}

/** One package lookup per request, shared by metadata and page rendering. */
export const getPackageBySlug = cache(async (slug: string) => {
  const trpc = await getServerTrpc();
  return trpc.umrah.packageBySlug.query({ slug });
});
