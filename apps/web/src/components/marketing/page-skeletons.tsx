import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading skeletons for the public hotel / venue / flight pages.
 * Each mirrors its page's final layout (hero band height, grid columns,
 * sidebar width) so the swap to real content does not shift the page.
 */

const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

function HeroBand({ className = "h-[300px] lg:h-[280px]" }: { className?: string }) {
  return (
    <div className={`bg-sidebar ${className}`}>
      <div className={`${CONTAINER} space-y-5 pt-10 lg:pt-14`}>
        <Skeleton className="h-9 w-2/3 max-w-md bg-white/10" />
        <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export function HotelListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading hotels">
      <HeroBand />
      <div className={`${CONTAINER} py-8`}>
        <div className="grid gap-6 lg:grid-cols-[268px_1fr]">
          <Skeleton className="hidden h-96 rounded-xl lg:block" />
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[210px_1fr] lg:grid-cols-[210px_1fr_190px]"
              >
                <Skeleton className="h-40 w-full rounded-xl" />
                <div className="space-y-2.5">
                  <Skeleton className="h-6 w-3/5" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-1 lg:flex-col">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-28 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Detail page: breadcrumb, gallery, two-column body with a sticky summary card. */
export function PropertyDetailSkeleton({
  maxWidth = "max-w-6xl",
  aside = "lg:grid-cols-[1fr_320px]",
  gallery = "h-64 sm:h-96",
}: {
  maxWidth?: string;
  aside?: string;
  gallery?: string;
}) {
  return (
    <div aria-busy="true" aria-label="Loading" className={`mx-auto ${maxWidth} px-4 py-6 sm:px-6 lg:px-8`}>
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className={`w-full rounded-2xl ${gallery}`} />
      <div className={`mt-6 grid grid-cols-1 gap-8 ${aside}`}>
        <div className="space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-4 pt-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function BookingReviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="mb-4 h-4 w-56" />
      <Skeleton className="h-8 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function VenueListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading venues">
      <HeroBand className="h-[340px] lg:h-[400px]" />
      <div className={`${CONTAINER} py-10`}>
        <div className="mb-8 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="space-y-2.5 p-5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-4 h-6 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FlightsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading flights">
      <div className="bg-[#04241d]">
        <div className={`${CONTAINER} space-y-6 pt-12 pb-14 lg:pt-16 lg:pb-20`}>
          <Skeleton className="h-10 w-72 bg-white/10" />
          <Skeleton className="h-11 w-64 rounded-full bg-white/10" />
          <Skeleton className="h-52 w-full rounded-2xl bg-white/10 lg:h-40 lg:max-w-[72%] xl:max-w-[64%]" />
        </div>
      </div>
      <div className={`${CONTAINER} space-y-4 py-10`}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** /umrah/group: hero band, then tiered three-up package grids. */
export function PackageGridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading packages">
      <HeroBand className="h-[320px] lg:h-[360px]" />
      <div className={`${CONTAINER} space-y-6 py-12 sm:py-16`}>
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="mt-3 h-7 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** /checkout/[orderId]: title, payment card, and the order summary rail. */
export function CheckoutSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading checkout" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Skeleton className="mb-6 h-8 w-48 lg:mb-8" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <Skeleton className="h-72 w-full rounded-2xl lg:col-start-2 lg:row-start-1" />
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
          <Skeleton className="ml-auto h-10 w-44 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** /visa/apply/[id] and the Umrah builder: banner, step rail, form card. */
export function WizardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className={`${CONTAINER} py-6`}>
      <Skeleton className="mb-4 h-4 w-56" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <Skeleton className="h-24 w-full rounded-2xl lg:h-80" />
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <Skeleton className="h-7 w-56" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="ml-auto h-10 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** /checkout/[orderId]/success: status mark, details card, actions. */
export function ConfirmationSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
      <Skeleton className="mx-auto size-16 rounded-full" />
      <Skeleton className="mx-auto mt-4 h-8 w-64" />
      <Skeleton className="mt-8 h-64 w-full rounded-2xl" />
      <Skeleton className="mx-auto mt-8 h-11 w-60 rounded-lg" />
    </div>
  );
}
