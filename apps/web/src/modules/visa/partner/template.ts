import "server-only";
import type { ApplicationDetail } from "@/modules/visa/queries";

/** Dot-path read, e.g. getPath(obj, "data.applicant.name"). Array indices work as plain numeric keys ("data.0.id"). */
export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/**
 * Fills `{{path}}` tokens in every string found anywhere inside `value`
 * (recursing through objects and arrays) by looking `path` up in `context`.
 * A token that resolves to nothing becomes an empty string rather than the
 * literal `{{...}}` — an admin-configured request should never leak
 * template syntax into a real API call.
 */
export function interpolate(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
      const resolved = getPath(context, path);
      return resolved === null || resolved === undefined ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, context)]));
  }
  return value;
}

/**
 * The fields a custom adapter's request template can reference. Named
 * groups (traveler/travel/contact/visaType), not the raw jsonb column
 * shapes verbatim, so a template stays readable
 * ("{{traveler.passport_number}}") without an admin needing to know this
 * app's internal column names.
 */
export function buildApplicationContext(application: ApplicationDetail): Record<string, unknown> {
  return {
    application: {
      id: application.id,
      ref: application.application_ref,
      price: application.price,
      currency: application.currency,
    },
    traveler: application.traveler_details ?? {},
    travel: application.travel_details ?? {},
    contact: application.contact_details ?? {},
    visaType: application.visa_type
      ? {
          name: application.visa_type.name,
          destinationCountryCode: application.visa_type.destination_country_code,
          category: application.visa_type.visa_category,
        }
      : {},
  };
}
