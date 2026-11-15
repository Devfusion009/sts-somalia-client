import "server-only";
import { UMRAH_OPERATIONS_DEFAULTS, type UmrahOperations } from "@sts/shared-types";
import { getServerTrpc } from "@/lib/trpc/server";

export { UMRAH_OPERATIONS_DEFAULTS, type UmrahOperations } from "@sts/shared-types";

/** Platform-wide Umrah operating settings; the defaults mirror SQL's when the API can't answer. */
export async function getUmrahOperations(): Promise<UmrahOperations> {
  try {
    const trpc = await getServerTrpc();
    return await trpc.umrah.operations.query();
  } catch {
    return UMRAH_OPERATIONS_DEFAULTS;
  }
}

/** When an unpaid group booking created at `createdAt` releases its seats. */
export async function umrahSeatHoldEnd(createdAt: string): Promise<Date> {
  return new Date(new Date(createdAt).getTime() + 30 * 60 * 1000);
}
