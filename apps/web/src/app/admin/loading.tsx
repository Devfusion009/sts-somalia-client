import Image from "next/image";

/**
 * Entry splash for the admin console. It is the boundary above the portal
 * layout, so it shows while the session and profile resolve after sign-in;
 * moves between admin pages fall through to the route-level skeletons.
 */
export default function AdminEntryLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading admin console"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <div className="flex w-[17.5rem] flex-col items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
            <Image src="/logo-icon.png" alt="" width={790} height={790} priority className="size-8 object-contain" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight">STS Somalia</span>
        </div>

        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-primary/15" aria-hidden>
          <div className="animate-progress-sweep h-full w-1/4 rounded-full bg-primary" />
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Loading admin console
        </p>
      </div>
    </div>
  );
}
