import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToCustomer } from "@/lib/notifications/dispatch";
import { rootOrigin } from "@/lib/subdomain";
import { renderNotice, type EmailTone } from "@/lib/notifications/email-layout";

/**
 * Email / WhatsApp for the moments an applicant has to act or wants to know
 * now. In-app notifications already come from the case event log; this adds
 * the out-of-app channels, respecting the applicant's preferences. The
 * message carries the reference and one line — never passport data.
 * Best-effort: a delivery failure never undoes the action that caused it.
 */
export type VisaNotifyKind =
  | "documents_requested"
  | "appointment_booked"
  | "decision_recorded"
  | "passport_ready"
  | "message";

const SUBJECTS: Record<VisaNotifyKind, string> = {
  documents_requested: "Action needed on your visa application",
  appointment_booked: "Your visa appointment is booked",
  decision_recorded: "Decision on your visa application",
  passport_ready: "Your passport is ready",
  message: "New message about your visa application",
};

const LABELS: Record<VisaNotifyKind, { label: string; tone: EmailTone }> = {
  documents_requested: { label: "Action needed", tone: "warning" },
  appointment_booked: { label: "Appointment booked", tone: "success" },
  decision_recorded: { label: "Decision recorded", tone: "neutral" },
  passport_ready: { label: "Passport ready", tone: "success" },
  message: { label: "New message", tone: "neutral" },
};

export async function notifyVisaCustomer(applicationId: string, kind: VisaNotifyKind, line: string) {
  try {
    const admin = createAdminClient();
    const { data: app } = await admin
      .from("visa_applications")
      .select("application_ref, submitted_by, applicant_profile_id, contact_details")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return;

    const profileId = app.applicant_profile_id ?? app.submitted_by;
    const { data: profile } = await admin.from("profiles").select("email, phone").eq("id", profileId).maybeSingle();
    const contact = (app.contact_details ?? {}) as Record<string, string>;
    const email = contact.email || profile?.email || null;
    const phone = contact.mobile || profile?.phone || null;

    const url = `${rootOrigin()}/account/visa/${applicationId}`;
    const subject = `${SUBJECTS[kind]} — ${app.application_ref}`;
    const text = `${app.application_ref}: ${line}\n${url}`;
    const html = renderNotice({
      ...LABELS[kind],
      heading: SUBJECTS[kind],
      line,
      reference: { label: "Application", value: app.application_ref },
      button: { label: "Open your application", href: url },
      audience: "Visa services",
    });

    await dispatchToCustomer({
      profileId,
      email,
      phone,
      content: { en: { subject, html, text } },
      critical: kind === "decision_recorded",
    });
  } catch {
    // Out-of-app delivery is best-effort; the in-app notification already exists.
  }
}
