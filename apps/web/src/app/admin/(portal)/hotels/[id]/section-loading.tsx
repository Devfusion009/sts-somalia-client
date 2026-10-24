import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingShell, TabBar, Title } from "@/components/dashboard/admin-skeletons";

const TABS = ["Overview", "Bookings", "Rates", "Refunds", "Guests", "Reports"];

/** Fallback for the hotel section pages: the section header and tab strip, then the view's own frame. */
export function HotelSectionLoading({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <LoadingShell label={label}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <TabBar labels={TABS} />
      </div>
      <div className="mx-auto max-w-5xl space-y-6">
        {title ? <Title title={title} /> : null}
        {children}
      </div>
    </LoadingShell>
  );
}
