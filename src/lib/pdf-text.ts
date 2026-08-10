/**
 * Makes UI strings safe for the standard PDF fonts.
 *
 * @react-pdf/renderer's built-in Helvetica is a standard Type 1 font encoded
 * with WinAnsi. Any character outside that set is emitted as its low byte, so
 * "→" (U+2192) silently prints as "’" — WinAnsi 0x92 — and a hotel voucher
 * ends up reading "9 Sep 2026 ’ 13 Sep 2026".
 *
 * describeOrderItem() is shared with the web UI, where the arrow is correct and
 * should stay. Rather than degrade the HTML, the substitution happens here, at
 * the PDF boundary, and only for the glyphs that are actually broken. Anything
 * already in WinAnsi (· • – — “ ” ‘ ’ €) is left alone.
 *
 * KNOWN LIMITATION: this does not make Arabic or extended-Latin names render.
 * Helvetica has no glyphs for them at all, and fixing that needs a registered
 * TrueType font with the right subset — a separate change, tracked as a launch
 * task rather than papered over here.
 */

const REPLACEMENTS: Array<[RegExp, string]> = [
  // Directional arrows used for date ranges and flight routes.
  [/[→➡➔]/g, "–"],
  [/[←⬅]/g, "–"],
  [/[↔⇄⇆]/g, "–"],
  // Ellipsis: WinAnsi has 0x85, but react-pdf's mapping is unreliable for it.
  [/…/g, "..."],
  // Non-breaking and thin spaces read as boxes in some viewers.
  [/[   ]/g, " "],
];

export function pdfText(value: string | null | undefined): string {
  if (!value) return "";
  let out = value;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
