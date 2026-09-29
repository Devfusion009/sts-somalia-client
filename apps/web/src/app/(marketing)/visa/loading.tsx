/**
 * Instant fallback for /visa while `getVisaTypes` resolves — shown on first
 * load and on every search submit, since the query string re-runs the same
 * async server component. Modelled on the interstitial competitors show
 * during a search transition: dimmed backdrop, centred card, single icon,
 * one line of copy. No parameters are available here (Next.js constraint),
 * so the copy stays generic rather than echoing the submitted destination.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center rounded-3xl bg-card px-8 py-10 text-center shadow-2xl ring-1 ring-border/60">
        <span className="animate-stamp-thump flex size-20 items-center justify-center">
          <svg viewBox="0 0 64 64" fill="none" strokeWidth={3.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-full">
            <rect x="9" y="7" width="33" height="46" rx="4" stroke="var(--brand-accent)" />
            <line x1="16" y1="19" x2="35" y2="19" stroke="var(--brand-accent)" />
            <line x1="16" y1="27" x2="35" y2="27" stroke="var(--brand-accent)" />
            <line x1="16" y1="35" x2="28" y2="35" stroke="var(--brand-accent)" />
            <circle cx="43" cy="44" r="15" fill="var(--card)" stroke="none" />
            <circle cx="43" cy="44" r="12" stroke="var(--primary)" />
            <path d="M37.5 44.5l3.8 3.8 8-8.6" stroke="var(--primary)" />
          </svg>
        </span>

        <p className="mt-6 text-base leading-snug font-semibold text-foreground">
          Checking visa requirements across 150+ destinations…
        </p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="animate-progress-sweep h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
