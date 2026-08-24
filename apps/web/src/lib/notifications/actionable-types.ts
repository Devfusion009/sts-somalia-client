/**
 * Notification types that mean "the customer, not staff, needs to act."
 * Lives outside customer-notification-bell.tsx (a "use client" module)
 * deliberately: every export of a client module becomes an opaque client
 * reference when imported into a Server Component, so a plain Set exported
 * from there resolves to something with no .has() on the server — this file
 * has no directive, so account/layout.tsx (server) and the bell (client)
 * both get the real Set.
 */
export const ACTIONABLE_TYPES = new Set(["application_more_info_requested", "application_document_rejected"]);
