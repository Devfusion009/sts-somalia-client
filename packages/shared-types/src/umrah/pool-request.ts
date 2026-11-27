import { z } from "zod";
import { pilgrimDetailsSchema } from "./dto";

export const poolRequestStatusSchema = z.enum(["requested", "payment_due", "paid", "withdrawn", "expired", "cancelled"]);
export type PoolRequestStatus = z.infer<typeof poolRequestStatusSchema>;
export const poolFormationStatusSchema = z.enum(["draft", "forming", "activation_pending", "payment_open", "ready", "completed", "cancelled"]);
export type PoolFormationStatus = z.infer<typeof poolFormationStatusSchema>;
export const POOL_REQUEST_LABELS: Record<PoolRequestStatus, string> = {
  requested: "Awaiting group completion", payment_due: "Group confirmed — payment due",
  paid: "Booking confirmed", withdrawn: "Withdrawn", expired: "Expired", cancelled: "Cancelled",
};
export const ACTIVE_POOL_REQUEST_STATUSES = ["requested", "payment_due", "paid"] as const;

export function poolRequestCapacity(capacity: number, requests: { numPilgrims: number; status: PoolRequestStatus }[]) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Enter a valid capacity.");
  let allocated = 0, paid = 0;
  for (const request of requests) {
    if (!Number.isSafeInteger(request.numPilgrims) || request.numPilgrims < 1) throw new Error("Enter a valid pilgrim count.");
    if ((ACTIVE_POOL_REQUEST_STATUSES as readonly string[]).includes(request.status)) allocated += request.numPilgrims;
    if (request.status === "paid") paid += request.numPilgrims;
  }
  if (allocated > capacity) throw new Error("Pool capacity exceeded.");
  return { allocated, paid, unpaid: allocated - paid, remaining: capacity - allocated };
}

const transitions: Record<PoolRequestStatus, readonly PoolRequestStatus[]> = {
  requested: ["payment_due", "withdrawn", "cancelled"], payment_due: ["paid", "withdrawn", "expired", "cancelled"],
  paid: ["cancelled"], withdrawn: [], expired: [], cancelled: [],
};
export function canTransitionPoolRequest(from: PoolRequestStatus, to: PoolRequestStatus) {
  return transitions[from].includes(to);
}

export function poolPaymentDeadline(now: string, windowHours: number, cutoff: string): string {
  const start = Date.parse(now), end = Date.parse(cutoff);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isInteger(windowHours) || windowHours < 1 || windowHours > 168) {
    throw new Error("Enter valid payment deadlines.");
  }
  const due = start + windowHours * 3_600_000;
  if (due > end) throw new Error("The full payment window is no longer available.");
  return new Date(due).toISOString();
}

/** Amounts are integer minor units; currency conversion is never implicit. */
export function poolQuoteMinor(unitMinor: number, pilgrims: number, markupMinor = 0, feesMinor = 0) {
  if (![unitMinor, pilgrims, markupMinor, feesMinor].every(Number.isSafeInteger) || unitMinor <= 0 || pilgrims < 1 || markupMinor < 0 || feesMinor < 0) {
    throw new Error("Enter a valid quote.");
  }
  const total = unitMinor * pilgrims + markupMinor + feesMinor;
  if (!Number.isSafeInteger(total)) throw new Error("Quote exceeds the supported amount.");
  return total;
}

export const poolRequestPartySchema = z.object({
  agencyCustomerId: z.string().uuid().optional(),
  pilgrims: z.array(pilgrimDetailsSchema).min(1).max(60),
  roomSharing: z.number().int().min(1).max(4).optional(),
  specialRequests: z.string().trim().max(2000).default(""),
});
export const submitPoolRequestSchema = z.object({
  departureId: z.string().uuid(), idempotencyKey: z.string().uuid(),
  parties: z.array(poolRequestPartySchema).min(1).max(60),
  termsAccepted: z.literal(true),
});
export type SubmitPoolRequestInput = z.infer<typeof submitPoolRequestSchema>;
export const configurePoolSchema = z.object({
  departureId: z.string().uuid(), formationClosesAt: z.string().datetime({ offset: true }),
  paymentCutoffAt: z.string().datetime({ offset: true }), paymentWindowHours: z.number().int().min(1).max(168).default(48),
  terms: z.string().trim().min(10).max(5000),
}).superRefine((value, ctx) => {
  try { poolPaymentDeadline(value.formationClosesAt, value.paymentWindowHours, value.paymentCutoffAt); }
  catch { ctx.addIssue({ code: "custom", path: ["paymentCutoffAt"], message: "Allow the full payment window after formation closes." }); }
});
