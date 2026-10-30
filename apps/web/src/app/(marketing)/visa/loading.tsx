export default function Loading() {
  return (
    <div role="status" aria-label="Loading visa services" className="motion-safe:animate-pulse">
      <div className="border-b border-border bg-[#f5f5ed]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5"><div className="h-8 w-40 rounded-full bg-primary/10" /><div className="h-16 w-4/5 rounded-xl bg-primary/10" /><div className="h-16 w-full rounded-xl bg-primary/10" /></div>
            <div className="h-72 rounded-[2rem] bg-primary/10 sm:h-96" />
          </div>
          <div className="mt-8 rounded-3xl border border-border bg-card p-6"><div className="mb-5 h-5 w-52 rounded bg-muted" /><div className="grid gap-4 md:grid-cols-[1fr_1.2fr_auto]"><div className="h-20 rounded-xl bg-muted" /><div className="h-20 rounded-xl bg-muted" /><div className="h-20 rounded-xl bg-primary/15 md:w-44" /></div></div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="mb-8 h-9 w-72 max-w-full rounded bg-muted" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-80 rounded-2xl border border-border bg-muted" />)}</div></div>
    </div>
  );
}
