/**
 * Serialises a JSON-LD payload for a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` does NOT escape `<`, so any string that reaches this from
 * user or CMS content could close the script tag and inject markup. Next's
 * JSON-LD guide calls this out explicitly; escaping `<` to its unicode form is
 * the documented mitigation and is invisible to JSON-LD consumers.
 *
 * Render the result at page/layout level rather than inside a nested
 * component — a `<script>` that ends up rendering on the client is never
 * executed, and React warns about it.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
