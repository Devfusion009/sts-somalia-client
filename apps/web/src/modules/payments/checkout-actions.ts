"use server";

import { revalidatePath } from "next/cache";
import { initiatePaymentSchema, type InitiatePaymentInput, type InitiationResult } from "@sts/shared-types";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpcForActions, TRPCClientError, trpcErrorMessage } from "@/lib/trpc/server";

/** Use the same cookie-bound session as checkout's order read. Never replay a payment mutation. */
export async function initiateCheckoutPayment(input: InitiatePaymentInput): Promise<{
  error: string | null;
  result?: InitiationResult;
  orderId?: string;
  signInRequired?: boolean;
}> {
  const parsed = initiatePaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your payment details." };
  await requireUser(`/checkout/${parsed.data.orderId}`);
  try {
    const api = await getServerTrpcForActions();
    const result = await api.payments.initiate.mutate(parsed.data);
    revalidatePath(`/checkout/${parsed.data.orderId}`);
    return result;
  } catch (error) {
    if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
      return { error: "Your session could not be verified. Sign in again to continue.", signInRequired: true };
    }
    return { error: trpcErrorMessage(error, "Payment status could not be confirmed. Refresh checkout before trying again.") };
  }
}
