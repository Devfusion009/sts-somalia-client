/**
 * The STS Somalia transactional email frame. Direct port of apps/web's
 * lib/notifications/email-layout.ts; keep the two in step.
 *
 *   header   logo on white, audience tag on the right
 *   hero     deep-teal panel with the flight-route mark, status pill,
 *            heading and summary line, closed by the logo's orange stripe
 *   body     paragraphs, detail table, note, steps, button
 *   footer   team sign-off and contact on the left, "Connect with us" on
 *            the right, then the legal line and preferences link
 *
 * Built from tables with inline styles because that is what email clients
 * (Outlook, Gmail, Apple Mail) render consistently. Every value that came
 * from a user goes through `escapeHtml` before it is placed in the markup.
 *
 * The social row ends in SOCIAL_SLOT. `sendEmail` fills it from the
 * footer links an admin set in Site settings; anything rendering the
 * email without sending it just leaves an invisible HTML comment.
 */

const BRAND = "#00947c";
const DEEP = "#0b2e28";
const ACCENT = "#f08c21";
const INK = "#10231f";
const MUTED = "#5b6b67";
const LINE = "#e3e8e6";
const PAGE = "#eef2f1";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const SUPPORT_PHONE = "+252 611 444 420";
export const SUPPORT_EMAIL = "support@scoutsts.com";
const WHATSAPP_URL = "https://wa.me/252611444420";
const COMPANY_LINE = "Scout Travel Solution LTD, trading as STS Somalia · Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho, Somalia";

/** Placeholder `sendEmail` swaps for the admin-configured social links. */
export const SOCIAL_SLOT = "<!--sts:social-links-->";

/**
 * Where the logo and links point. Images in email must be absolute, so this
 * defaults to the live site even when QA or local sends the message.
 */
function siteOrigin(): string {
  return (process.env.EMAIL_ASSET_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "https://scoutsts.com").replace(/\/$/, "");
}

function assetOrigin(): string {
  return (process.env.EMAIL_ASSET_ORIGIN || "https://scoutsts.com").replace(/\/$/, "");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailTone = "success" | "warning" | "neutral";

/** Status pill colours on the dark hero. */
const TONE: Record<EmailTone, { bg: string; fg: string; dot: string }> = {
  success: { bg: "#d8f3ec", fg: "#00614f", dot: "#00947c" },
  warning: { bg: "#fdecd2", fg: "#8a4b00", dot: ACCENT },
  neutral: { bg: "#e6ecea", fg: "#33433f", dot: "#7a8a86" },
};

export type EmailContent = {
  /** Hidden inbox preview line, also shown under the heading. */
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
  /** Right side of the header, e.g. "Agent Portal". Defaults to the services line. */
  audience?: string;
  /** Pre-built body HTML placed after the paragraphs, for wrapped legacy messages. */
  rawHtml?: string;
};

export type SocialLinkItem = { label: string; short: string; href: string };

/** One round "Connect with us" badge; initials instead of images so every client shows it. */
export function socialBadge(item: SocialLinkItem): string {
  return `<a href="${escapeHtml(item.href)}" title="${escapeHtml(item.label)}" style="display:inline-block;width:32px;height:32px;line-height:32px;margin:0 0 6px 6px;border-radius:16px;background:${BRAND};color:#ffffff;font-family:${SANS};font-size:11px;font-weight:700;text-align:center;text-decoration:none;">${escapeHtml(item.short)}</a>`;
}

function routeMark(): string {
  const dash = `<td style="padding:0 3px;"><span style="display:block;width:7px;height:1px;background:#4f8d80;font-size:0;line-height:0;">&nbsp;</span></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="right" style="margin:0;">
    <tr>
      <td style="font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:0.18em;color:#8fd9c9;">MGQ</td>
      <td style="padding:0 6px;"><span style="display:block;width:7px;height:7px;border-radius:4px;background:#8fd9c9;font-size:0;line-height:0;">&nbsp;</span></td>
      ${dash}${dash}${dash}
      <td style="padding:0 6px;font-size:15px;line-height:1;color:${ACCENT};">&#9992;</td>
      ${dash}${dash}${dash}
      <td style="padding:0 0 0 6px;"><span style="display:block;width:7px;height:7px;border-radius:4px;border:1px solid #8fd9c9;font-size:0;line-height:0;">&nbsp;</span></td>
    </tr>
  </table>`;
}

export function renderEmail(content: EmailContent): string {
  const tone = TONE[content.tone];
  const site = siteOrigin();
  const assets = assetOrigin();
  const year = new Date().getFullYear();

  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 8px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate;background:#f8fbfa;">
        ${content.details
          .map(
            (row, i) => `<tr>
              <td style="padding:13px 18px;${i ? `border-top:1px solid ${LINE};` : ""}font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};width:40%;">${escapeHtml(row.label)}</td>
              <td style="padding:13px 18px;${i ? `border-top:1px solid ${LINE};` : ""}font-size:15px;font-weight:700;color:${INK};${row.mono ? `font-family:${MONO};letter-spacing:0.03em;` : ""}">${escapeHtml(row.value)}</td>
            </tr>`
          )
          .join("")}
      </table>`
    : "";

  const note = content.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
        <tr><td style="padding:16px 18px;background:#fdf4e6;border-left:4px solid ${ACCENT};border-radius:8px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8a4b00;">${escapeHtml(content.note.title)}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(content.note.body)}</p>
        </td></tr>
      </table>`
    : "";

  const steps = content.steps?.items.length
    ? `<p style="margin:30px 0 12px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND};">${escapeHtml(content.steps.title)}</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
        ${content.steps.items
          .map(
            (item, i) => `<tr>
              <td valign="top" style="padding:0 14px 12px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:${DEEP};color:#ffffff;font-size:12px;font-weight:700;text-align:center;">${i + 1}</span></td>
              <td valign="top" style="padding:3px 0 12px;font-size:14px;line-height:1.55;color:${INK};">${escapeHtml(item)}</td>
            </tr>`
          )
          .join("")}
       </table>`
    : "";

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 6px;">
        <tr><td bgcolor="${BRAND}" style="border-radius:999px;background:${BRAND};">
          <a href="${escapeHtml(content.button.href)}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(content.button.label)}&nbsp;&nbsp;&rarr;</a>
        </td></tr>
      </table>`
    : "";

  const staticSocial = [
    socialBadge({ label: "WhatsApp", short: "WA", href: WHATSAPP_URL }),
    socialBadge({ label: "Website", short: "www", href: site }),
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
<style>
  @media only screen and (max-width:620px) {
    .sts-pad { padding-left:22px !important; padding-right:22px !important; }
    .sts-col { display:block !important; width:100% !important; text-align:left !important; }
    .sts-col-gap { padding-top:22px !important; }
    .sts-hide { display:none !important; }
    .sts-h1 { font-size:23px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background:${PAGE};">
    <tr><td align="center" style="padding:28px 12px 36px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};font-family:${SANS};">

        <tr><td class="sts-pad" style="padding:20px 32px;background:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle"><a href="${escapeHtml(site)}" style="text-decoration:none;"><img src="${assets}/logo.png" width="87" height="38" alt="STS Somalia" style="display:block;border:0;outline:none;width:87px;height:38px;"></a></td>
              <td valign="middle" align="right" style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${escapeHtml(content.audience ?? "Travel · Umrah · Visas")}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td class="sts-pad" bgcolor="${DEEP}" style="background-color:${DEEP};background-image:linear-gradient(135deg,${DEEP} 0%,#0c4a3f 58%,#007e69 100%);padding:30px 32px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle">
                <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;"><span style="display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:4px;background:${tone.dot};vertical-align:1px;"></span>${escapeHtml(content.label)}</span>
              </td>
              <td valign="middle" align="right" class="sts-hide">${routeMark()}</td>
            </tr>
          </table>
          <h1 class="sts-h1" style="margin:22px 0 0;font-size:27px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:#ffffff;">${escapeHtml(content.heading)}</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#bfe7de;">${escapeHtml(content.preheader)}</p>
        </td></tr>
        <tr><td bgcolor="${ACCENT}" style="height:4px;background:${ACCENT};line-height:4px;font-size:0;">&nbsp;</td></tr>

        <tr><td class="sts-pad" style="padding:14px 32px 34px;font-size:15px;line-height:1.65;color:${INK};">
          ${content.paragraphs.map((p) => `<p style="margin:16px 0 0;">${p}</p>`).join("")}
          ${content.rawHtml ? `<div style="margin:16px 0 0;">${content.rawHtml}</div>` : ""}
          ${details}
          ${note}
          ${steps}
          ${button}
        </td></tr>

        <tr><td class="sts-pad" style="padding:28px 32px;border-top:1px solid ${LINE};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="sts-col" valign="top" width="55%" style="font-size:14px;line-height:1.6;color:${INK};">
                <p style="margin:0;">Need a hand?</p>
                <p style="margin:2px 0 12px;font-weight:700;">The STS Somalia team</p>
                <p style="margin:0;font-size:13px;color:${MUTED};">
                  Reply to this email<br>
                  <a href="tel:${SUPPORT_PHONE.replace(/\s/g, "")}" style="color:${BRAND};text-decoration:none;font-weight:600;">${SUPPORT_PHONE}</a><br>
                  <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
                </p>
              </td>
              <td class="sts-col sts-col-gap" valign="top" align="right" style="font-size:14px;color:${INK};">
                <img src="${assets}/logo.png" width="64" height="28" alt="" style="display:inline-block;border:0;width:64px;height:28px;">
                <p style="margin:12px 0 10px;font-weight:600;">Connect with us</p>
                <div>${staticSocial}${SOCIAL_SLOT}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td class="sts-pad" bgcolor="#f6f9f8" style="padding:20px 32px 24px;background:#f6f9f8;border-top:1px solid ${LINE};font-size:11px;line-height:1.65;color:#83918d;">
          <p style="margin:0 0 8px;">&copy; ${year} ${escapeHtml(COMPANY_LINE)}</p>
          <p style="margin:0 0 8px;">You received this email because of activity on your STS account. Replies reach our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color:#5b6b67;">${SUPPORT_EMAIL}</a>.</p>
          <p style="margin:0;"><a href="${escapeHtml(site)}/account/preferences" style="color:#5b6b67;">Email preferences</a> &nbsp;·&nbsp; <a href="${escapeHtml(site)}" style="color:#5b6b67;">scoutsts.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A one-event message: status pill, heading, one line, the reference, a button. */
export function renderNotice(input: {
  label: string;
  tone: EmailTone;
  heading: string;
  line: string;
  reference?: { label: string; value: string };
  button?: { label: string; href: string };
  audience?: string;
}): string {
  return renderEmail({
    preheader: input.line,
    label: input.label,
    tone: input.tone,
    heading: input.heading,
    paragraphs: [],
    details: input.reference ? [{ label: input.reference.label, value: input.reference.value, mono: true }] : undefined,
    button: input.button,
    audience: input.audience,
  });
}

/**
 * Puts a message that was written as a bare HTML fragment into the branded
 * frame, so no email leaves STS unstyled. Full documents pass through.
 */
export function wrapEmailHtml(subject: string, html: string): string {
  if (/^\s*<!doctype/i.test(html)) return html;
  return renderEmail({ preheader: subject, label: "STS update", tone: "neutral", heading: subject, paragraphs: [], rawHtml: html });
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
  lines.push(
    "The STS Somalia team",
    `Reply to this email, call ${SUPPORT_PHONE} or write to ${SUPPORT_EMAIL}.`,
    `WhatsApp: ${WHATSAPP_URL}`,
    "",
    COMPANY_LINE
  );
  return lines.join("\n");
}
