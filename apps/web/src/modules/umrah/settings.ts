import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { HAND_IN_TYPES, type HandInType } from "@/modules/umrah/readiness";

/**
 * Platform-wide Umrah operating settings, one platform_settings row
 * ('umrah_operations', seeded by 20261019000004). SQL reads the same row
 * through umrah_setting(); these defaults mirror the SQL fallbacks so the
 * app and the database agree when a key is missing.
 */
export type UmrahOperations = {
  /** Hours an unpaid group booking holds its seats before it is released. */
  unpaidHoldHours: number;
  privateDepositPercent: number;
  privateBalanceDueDays: number;
  /** Minimum days between today and a private trip's departure. */
  privateLeadDays: number;
  privateFullPaymentBeforeDocuments: boolean;
  /** Refuse 'visa_processing' while a pilgrim is missing passport data. */
  visaRequiresPassport: boolean;
  requiredDocuments: HandInType[];
};

export const UMRAH_OPERATIONS_DEFAULTS: UmrahOperations = {
  unpaidHoldHours: 48,
  privateDepositPercent: 50,
  privateBalanceDueDays: 30,
  privateLeadDays: 0,
  privateFullPaymentBeforeDocuments: true,
  visaRequiresPassport: true,
  requiredDocuments: [],
};

function num(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function getUmrahOperations(): Promise<UmrahOperations> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_settings").select("value").eq("key", "umrah_operations").maybeSingle();
    const raw = (data?.value ?? {}) as Record<string, unknown>;
    const d = UMRAH_OPERATIONS_DEFAULTS;
    return {
      unpaidHoldHours: num(raw.unpaidHoldHours, d.unpaidHoldHours),
      privateDepositPercent: num(raw.privateDepositPercent, d.privateDepositPercent),
      privateBalanceDueDays: num(raw.privateBalanceDueDays, d.privateBalanceDueDays),
      privateLeadDays: num(raw.privateLeadDays, d.privateLeadDays),
      privateFullPaymentBeforeDocuments:
        typeof raw.privateFullPaymentBeforeDocuments === "boolean"
          ? raw.privateFullPaymentBeforeDocuments
          : d.privateFullPaymentBeforeDocuments,
      visaRequiresPassport:
        typeof raw.visaRequiresPassport === "boolean" ? raw.visaRequiresPassport : d.visaRequiresPassport,
      requiredDocuments: Array.isArray(raw.requiredDocuments)
        ? raw.requiredDocuments.filter((t): t is HandInType => (HAND_IN_TYPES as readonly string[]).includes(String(t)))
        : d.requiredDocuments,
    };
  } catch {
    return UMRAH_OPERATIONS_DEFAULTS;
  }
}

/** When an unpaid group booking created at `createdAt` releases its seats. */
export async function umrahSeatHoldEnd(createdAt: string): Promise<Date> {
  const { unpaidHoldHours } = await getUmrahOperations();
  return new Date(new Date(createdAt).getTime() + unpaidHoldHours * 60 * 60 * 1000);
}
