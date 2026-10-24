/**
 * Class string for a native `<select>` styled to match `Input`
 * (40px on phones, focus ring, disabled state, dark surface).
 * Full width by default; add `w-auto` via `cn()` for inline filter selects.
 */
export const NATIVE_SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:h-10 md:text-sm dark:bg-input/30";
