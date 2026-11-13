import "server-only";
import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp-send";
import { renderEmail, escapeHtml } from "./email-layout";

/**
 * Best-effort org-level notification to a hotel/venue partner when a
 * booking lands on their property — same never-throws shape as
 * notifyApplicant() (application-notify.ts), sent once to the partner's own
 * contact_email/contact_phone rather than per staff member (the in-app bell,
 * fired by the DB trigger on hotel_bookings/hall_bookings insert, already
 * reaches every staff member individually).
 */
export async function notifyPartnerOfBooking(params: {
  partnerEmail: string;
  partnerPhone?: string | null;
  propertyName: string;
  summary: string; // e.g. "2 rooms, 12 Sep → 15 Sep" or "Wedding, 20 people, 5 Oct"
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
