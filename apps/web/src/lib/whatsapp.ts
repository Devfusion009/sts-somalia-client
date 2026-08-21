/**
 * WhatsApp click-to-chat links (wa.me). Number comes from
 * NEXT_PUBLIC_WHATSAPP_NUMBER (digits only, country code included); the
 * fallback is the STS support line already published on the site.
 */
export const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "252611444420"
).replace(/\D/g, "");

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Agency (B2B) support line — kept separate from the B2C number so agency
 * calls/chats route to whoever handles the agent desk. Falls back to the
 * main line if no dedicated number is configured.
 */
export const WHATSAPP_AGENCY_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_AGENCY_NUMBER ?? WHATSAPP_NUMBER
).replace(/\D/g, "");

export function agencyWhatsappLink(agencyName: string, message?: string) {
  const base = `https://wa.me/${WHATSAPP_AGENCY_NUMBER}`;
  const text = message ?? `Hello STS! This is ${agencyName}. We need help with our agency account.`;
  return `${base}?text=${encodeURIComponent(text)}`;
}
