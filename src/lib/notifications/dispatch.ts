import "server-only";
import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp-send";
import { getPreferencesForProfile } from "@/modules/preferences/queries";

/**
 * Preference-aware fan-out for customer notifications.
 *
 * Every customer-facing message should go through here rather than calling
 * sendEmail/sendWhatsAppMessage directly, so a channel the customer switched
 * off in /account/preferences is actually respected. Senders that bypass this
 * are how "unsubscribe" becomes a lie.
 *
 * Best-effort by design: a delivery failure never throws, because a
 * notification problem must not roll back the booking change that triggered it.
 */

export type DispatchLanguage = "en" | "so" | "ar";

export type LocalisedContent = {
  subject: string;
  html: string;
  /** Plain-text variant for WhatsApp/SMS. */
  text: string;
};

export type DispatchResult = {
  emailSent: boolean;
  whatsappSent: boolean;
  smsSent: boolean;
  /** Channels skipped because the customer turned them off. */
  suppressed: string[];
};

export async function dispatchToCustomer(params: {
  profileId: string;
  email?: string | null;
  phone?: string | null;
  /**
   * Content per language. `en` is required as the fallback — a customer who
   * picked Somali still needs the message if only English copy exists yet.
   */
  content: { en: LocalisedContent } & Partial<Record<DispatchLanguage, LocalisedContent>>;
  /**
   * Security and legal notices (password changed, account deletion, visa
   * decision) ignore channel preferences on email. A customer cannot opt out of
   * being told their password was changed.
   */
  critical?: boolean;
}): Promise<DispatchResult> {
  const prefs = await getPreferencesForProfile(params.profileId);
  const language = (prefs.language ?? "en") as DispatchLanguage;
  const content = params.content[language] ?? params.content.en;

  const suppressed: string[] = [];
  let emailSent = false;
  let whatsappSent = false;

  if (params.email && (prefs.email_enabled || params.critical)) {
    const result = await sendEmail({
      to: params.email,
      subject: content.subject,
      html: content.html,
    });
    emailSent = result.sent;
  } else if (params.email) {
    suppressed.push("email");
  }

  if (params.phone && prefs.whatsapp_enabled) {
    const result = await sendWhatsAppMessage({ to: params.phone, body: content.text });
    whatsappSent = result.sent;
  } else if (params.phone) {
    suppressed.push("whatsapp");
  }

  // No SMS provider is wired yet. Reported as not-sent rather than silently
  // dropped so callers can surface the truth in staff-facing UI.
  const smsSent = false;
  if (params.phone && prefs.sms_enabled) suppressed.push("sms (not configured)");

  return { emailSent, whatsappSent, smsSent, suppressed };
}
