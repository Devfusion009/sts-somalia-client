import "server-only";
import type { PackageCard } from "@sts/shared-types";
import { getServerTrpc } from "@/lib/trpc/server";
import type { PackageCardData } from "@/modules/umrah/components/package-card";
import { umrahImageUrls } from "@/modules/umrah/images";

export { bookableDepartures } from "@sts/shared-types";

/** Card DTO from the API with image paths resolved to URLs for <img>. */
function toCardData(card: PackageCard): PackageCardData {
  return { ...card, images: umrahImageUrls(card.images) };
}

/** Landing band: featured first, then cheapest. Empty when the API is unreachable. */
export async function getFeaturedPackages(limit = 4): Promise<PackageCardData[]> {
  try {
    const trpc = await getServerTrpc();
    return (await trpc.umrah.featured.query({ limit })).filter((p) => p.package_type === "group").map(toCardData);
  } catch {
    return [];
  }
}

export async function getAllPackages(kind: "group" | "private" = "group"): Promise<PackageCardData[]> {
  try {
    const trpc = await getServerTrpc();
    return (await trpc.umrah.packages.query()).filter((p) => p.package_type === kind).map(toCardData);
  } catch {
    return [];
  }
}

/** Published package detail; the API releases stale unpaid seats before counting. */
export async function getPackageBySlug(slug: string) {
  const trpc = await getServerTrpc();
  return trpc.umrah.packageBySlug.query({ slug });
}
