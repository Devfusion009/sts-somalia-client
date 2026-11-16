import "server-only";
import { getServerTrpcForActions } from "@/lib/trpc/server";

export type WaafiTopupStatus = "success" | "pending" | "failed" | "unavailable";

/** The API checks agency access via RLS and uses the same settlement path as webhooks. */
export async function reconcileWaafiTopup(topupId: string, agencyId: string): Promise<WaafiTopupStatus> {
  try {
    const trpc = await getServerTrpcForActions();
    const status = await trpc.payments.confirmWaafiTopup.mutate({ topupId, agencyId });
    return status === "paid" ? "success" : status === "ignored" ? "unavailable" : status;
  } catch { return "pending"; }
}
