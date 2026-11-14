"use server";

import { redirect } from "next/navigation";
import { bookFlightSchema } from "@sts/shared-types";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

export type BookFlightState = { error: string | null; field?: string } | null;

const PASSENGER_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
  "passportCountry",
] as const;

function normalizePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `+${digits.slice(1).replace(/\+/g, "")}` : `+${digits}`;
}

/**
 * Books the selected fare. The API re-prices it with the airline, writes
 * the booking and its order, and on the agency desk pays from the wallet in
 * the same step. Customers continue to checkout; ticketing starts the
 * moment the order is paid in full.
 */
export async function bookFlight(_prev: BookFlightState, formData: FormData): Promise<BookFlightState> {
  await requireUser();
  const count = Math.min(Math.max(Number(formData.get("passengerCount")) || 0, 1), 9);
  const passengers = Array.from({ length: count }, (_, i) =>
    Object.fromEntries(PASSENGER_FIELDS.map((key) => [key, String(formData.get(`p${i}_${key}`) ?? "").trim()]))
  );
  const desk = formData.get("desk") === "1";

  const parsed = bookFlightSchema.safeParse({
    offerId: formData.get("offerId"),
    passengers,
    contactEmail: formData.get("contactEmail"),
    contactPhone: normalizePhone(String(formData.get("contactPhone") ?? "")),
    payFromWallet: desk && formData.get("payment") === "wallet",
    agencyCustomerId: formData.get("agencyCustomerId")?.toString() || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [scope, index, key] = issue.path;
    const field = scope === "passengers" ? `p${String(index)}_${String(key)}` : String(scope);
    const who = scope === "passengers" && count > 1 ? `Passenger ${Number(index) + 1}: ` : "";
    return { error: `${who}${issue.message}`, field };
  }

  let destination: string;
  try {
    const trpc = await getServerTrpcForActions();
    const result = await trpc.flights.book.mutate(parsed.data);
    if (result.error !== null) return { error: result.error };
    const notice = result.paymentError ? "?wallet=failed" : "";
    destination = desk
      ? `/agent/book/order/${result.orderId}${notice}`
      : result.paid
        ? `/account/bookings/${result.orderId}`
        : `/checkout/${result.orderId}`;
  } catch (error) {
    return { error: trpcErrorMessage(error, "The booking could not be completed. Try again.") };
  }
  redirect(destination);
}
