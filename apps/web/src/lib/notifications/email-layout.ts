import "server-only";

/**
 * The STS Somalia transactional email frame: brand header, status label,
 * heading, body, optional detail table and button, contact footer.
 *
 * Built from tables with inline styles because that is what email clients
 * (Outlook, Gmail, Apple Mail) render consistently. Every value that came
 * from a user goes through `escapeHtml` before it is placed in the markup.
 */

const BRAND = "#00947c";
const INK = "#10231f";
const MUTED = "#5b6b67";
const LINE = "#e3e8e6";

export const SUPPORT_PHONE = "+252 611 444 420";
export const SUPPORT_EMAIL = "info@scoutsts.com";
const COMPANY_LINE = "Scout Travel Solution LTD, trading as STS Somalia · Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho, Somalia";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailTone = "success" | "warning" | "neutral";

const TONE: Record<EmailTone, { bg: string; fg: string }> = {
  success: { bg: "#e7f6f2", fg: "#00745f" },
  warning: { bg: "#fdf3e1", fg: "#9a5b00" },
  neutral: { bg: "#eef1f0", fg: "#40504c" },
};

export type EmailContent = {
  /** Hidden inbox preview line. */
  preheader: string;
  /** Short status label above the heading, e.g. "Application approved". */
  label: string;
  tone: EmailTone;
  heading: string;
  /** Already-escaped HTML paragraphs. */
  paragraphs: string[];
  /** Label/value rows; values are escaped here. `mono` sets codes in a fixed-width face. */
  details?: Array<{ label: string; value: string; mono?: boolean }>;
  /** Numbered list; items are escaped here. */
  steps?: { title: string; items: string[] };
  /** Highlighted note, e.g. the reviewer's message; escaped here. */
  note?: { title: string; body: string };
  button?: { label: string; href: string };
};

export function renderEmail(content: EmailContent): string {
  const tone = TONE[content.tone];

  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;border:1px solid ${LINE};border-radius:10px;border-collapse:separate;">
        ${content.details
          .map(
            (row, i) => `<tr>
              <td style="padding:12px 16px;${i ? `border-top:1px solid ${LINE};` : ""}font-size:13px;color:${MUTED};width:42%;">${escapeHtml(row.label)}</td>
              <td style="padding:12px 16px;${i ? `border-top:1px solid ${LINE};` : ""}font-size:14px;font-weight:600;color:${INK};${row.mono ? "font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;letter-spacing:0.02em;" : ""}">${escapeHtml(row.value)}</td>
            </tr>`
          )
          .join("")}
      </table>`
    : "";

  const note = content.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td style="padding:14px 16px;background:${TONE.warning.bg};border-left:4px solid #d98a00;border-radius:6px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${TONE.warning.fg};">${escapeHtml(content.note.title)}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(content.note.body)}</p>
        </td></tr>
      </table>`
    : "";

  const steps = content.steps?.items.length
    ? `<p style="margin:28px 0 10px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND};">${escapeHtml(content.steps.title)}</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
        ${content.steps.items
          .map(
            (item, i) => `<tr>
              <td valign="top" style="padding:0 12px 10px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background:${BRAND};color:#ffffff;font-size:12px;font-weight:700;text-align:center;">${i + 1}</span></td>
              <td valign="top" style="padding:2px 0 10px;font-size:14px;line-height:1.55;color:${INK};">${escapeHtml(item)}</td>
            </tr>`
          )
          .join("")}
       </table>`
    : "";

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr><td style="border-radius:8px;background:${BRAND};">
          <a href="${escapeHtml(content.button.href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(content.button.label)}</a>
        </td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f4;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(content.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f4;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${LINE};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:#0d2b25;padding:22px 32px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:0.02em;color:#ffffff;">STS</span>
          <span style="font-size:20px;font-weight:300;color:#7fd6c4;"> Somalia</span>
        </td></tr>
        <tr><td style="height:4px;background:${BRAND};line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(content.label)}</span>
          <h1 style="margin:16px 0 0;font-size:24px;line-height:1.3;font-weight:800;color:${INK};">${escapeHtml(content.heading)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;font-size:15px;line-height:1.65;color:${INK};">
          ${content.paragraphs.map((p) => `<p style="margin:14px 0 0;">${p}</p>`).join("")}
          ${details}
          ${note}
          ${steps}
          ${button}
        </td></tr>
        <tr><td style="padding:22px 32px;background:#f8faf9;border-top:1px solid ${LINE};font-size:13px;line-height:1.6;color:${MUTED};">
          <p style="margin:0 0 6px;">Questions? Reply to this email, call <a href="tel:${SUPPORT_PHONE.replace(/\s/g, "")}" style="color:${BRAND};text-decoration:none;font-weight:600;">${SUPPORT_PHONE}</a> or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>.</p>
          <p style="margin:0;font-size:12px;color:#8a9894;">${escapeHtml(COMPANY_LINE)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Plain-text twin of `renderEmail`, for clients that do not render HTML. */
export function renderEmailText(content: EmailContent & { textParagraphs: string[] }): string {
  const lines: string[] = [content.heading, ""];
  lines.push(...content.textParagraphs.flatMap((p) => [p, ""]));
  if (content.details?.length) {
    lines.push(...content.details.map((row) => `${row.label}: ${row.value}`), "");
  }
  if (content.note) lines.push(`${content.note.title}:`, content.note.body, "");
  if (content.steps?.items.length) {
    lines.push(`${content.steps.title}:`, ...content.steps.items.map((item, i) => `${i + 1}. ${item}`), "");
  }
  if (content.button) lines.push(`${content.button.label}: ${content.button.href}`, "");
  lines.push(`Questions? Reply to this email, call ${SUPPORT_PHONE} or write to ${SUPPORT_EMAIL}.`, COMPANY_LINE);
  return lines.join("\n");
}
