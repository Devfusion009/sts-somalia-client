import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp-send";
import { escapeHtml, renderEmail } from "./email-layout";

/** Direct port of apps/web's lib/notifications/partner-booking-notify.ts. Best-effort, never throws. */
export async function notifyPartnerOfBooking(params: {
  partnerEmail: string;
  partnerPhone?: string | null;
  propertyName: string;
  summary: string;
}): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const subject = `New booking — ${params.propertyName}`;
  const html = renderEmail({
    preheader: params.summary,
    label: "New booking",
    tone: "success",
    heading: `New booking on ${params.propertyName}`,
    paragraphs: [escapeHtml("Payment is collected by STS Somalia. We'll be in touch to confirm the details.")],
    details: [
      { label: "Property", value: params.propertyName },
      { label: "Booking", value: params.summary },
    ],
    audience: "Partner Portal",
  });
  const whatsapp = `STS Somalia: New booking on ${params.propertyName} — ${params.summary}. Payment is handled by STS; we'll follow up with details.`;

  const emailResult = await sendEmail({ to: params.partnerEmail, subject, html });

  let whatsappSent = false;
  if (params.partnerPhone) {
    const waResult = await sendWhatsAppMessage({ to: params.partnerPhone, body: whatsapp });
    whatsappSent = waResult.sent;
  }

  return { emailSent: emailResult.sent, whatsappSent };
}
