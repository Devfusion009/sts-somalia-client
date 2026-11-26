import { step1AffiliateSchema, step1BusinessSchema, step2AffiliateSchema, step2ContactSchema, step3AgencySchema, step3HotelSchema, step3AffiliateSchema, step3VenueSchema, step4AgencySchema, step4HotelSchema } from "./schemas";
import type { ApplicationKind } from "./config";

export type DraftSnapshot = { fields: Record<string, string>; savedAt: number; revision?:number };
export const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function unconfirmedDraftStep(rows: {step:number;fields:Record<string,string>;confirmed_fields:Record<string,string>|null}[]):number|null {
  const changed=rows.filter(row=>JSON.stringify(Object.entries(row.fields).sort())!==JSON.stringify(Object.entries(row.confirmed_fields ?? {}).sort()));
  return changed.length ? Math.min(...changed.map(row=>row.step)) : null;
}

export function draftFields(kind: ApplicationKind, step: number, input: Record<string, unknown>): Record<string, string> {
  const schema = step === 1 ? kind === "affiliate" ? step1AffiliateSchema : step1BusinessSchema
    : step === 2 ? kind === "affiliate" ? step2AffiliateSchema : step2ContactSchema
    : step === 3 ? kind === "agency" ? step3AgencySchema : kind === "affiliate" ? step3AffiliateSchema : kind === "hotel_partner" ? step3HotelSchema : step3VenueSchema
    : step === 4 && kind !== "affiliate" ? kind === "agency" ? step4AgencySchema : step4HotelSchema : null;
  if (!schema) return {};
  return Object.fromEntries(Object.keys(schema.shape).flatMap(key => typeof input[key] === "string" && input[key].length <= 20_000 ? [[key, input[key]]] : []));
}

/** Preserve UI-only JSON fields and transform them back to the step's defaults. */
export function draftDetails(base: Record<string, unknown>, fields: Record<string, string>) {
  const details = { ...base, ...fields };
  for (const [field, target] of [["branchesJson", "branches"], ["roomTypesJson", "roomTypes"], ["handlesJson", "handles"]]) {
    if (field in fields) {
      try { const rows = JSON.parse(fields[field]); details[target] = Array.isArray(rows) ? rows : []; }
      catch { details[target] = []; }
    }
  }
  for (const key of ["products", "amenities", "eventTypes"]) {
    if (key in fields) details[key] = fields[key].split(",").filter(Boolean);
  }
  if ("requestedMarkupPreset" in fields) {
    details.requestedMarkupPercent = fields.requestedMarkupPreset === "custom" ? fields.requestedMarkupCustom ?? "" : fields.requestedMarkupPreset;
  }
  return details;
}

export function readLocalDraft(raw: string | null, now = Date.now()): DraftSnapshot | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || !Number.isFinite(value.savedAt) || value.savedAt > now + 60_000 || now - value.savedAt > DRAFT_MAX_AGE || !value.fields || Array.isArray(value.fields) || typeof value.fields !== "object") return null;
    return value;
  } catch { return null; }
}
