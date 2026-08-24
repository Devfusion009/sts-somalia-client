import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp-send";

/** Direct port of apps/web's lib/notifications/partner-booking-notify.ts. Best-effort, never throws. */
export async function notifyPartnerOfBooking(params: {
  partnerEmail: string;
  partnerPhone?: string | null;
  propertyName: string;
  summary: string;
}): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const subject = `New booking — ${params.propertyName}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a2e29;">
      <h1 style="color: #00947c; font-size: 20px;">New booking on ${params.propertyName}</h1>
      <p>${params.summary}</p>
      <p>Payment is collected by STS Somalia; we'll be in touch to confirm the details.</p>
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        STS Somalia &middot; Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho
      </p>
    </div>
  `;
  const whatsapp = `STS Somalia: New booking on ${params.propertyName} — ${params.summary}. Payment is handled by STS; we'll follow up with details.`;

  const emailResult = await sendEmail({ to: params.partnerEmail, subject, html });

  let whatsappSent = false;
  if (params.partnerPhone) {
    const waResult = await sendWhatsAppMessage({ to: params.partnerPhone, body: whatsapp });
    whatsappSent = waResult.sent;
  }

  return { emailSent: emailResult.sent, whatsappSent };
}
