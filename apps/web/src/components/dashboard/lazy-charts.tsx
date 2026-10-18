"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard charts, loaded after the page instead of with it. Recharts is
 * ~98 KB gzipped and only these charts use it, so importing them directly put
 * it in the initial bundle of the admin, agent and hotel-manager dashboards.
 *
 * ssr: false costs no first-paint content: the charts measure their container
 * in the browser, so the server only ever drew a fixed 320×200 placeholder
 * that jumped to full width on hydration. Each skeleton takes the chart's own
 * box, so nothing moves when the chart arrives.
 */

export const RevenueTrendChart = dynamic(
  () => import("@/modules/admin/components/revenue-trend-chart").then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full" /> }
);

export const BookingsByTypeChart = dynamic(
  () => import("@/modules/admin/components/bookings-by-type-chart").then((m) => m.BookingsByTypeChart),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full" /> }
);

export const UsersByRoleChart = dynamic(
  () => import("@/modules/admin/components/users-by-role-chart").then((m) => m.UsersByRoleChart),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> }
);

export const UserGrowthChart = dynamic(
  () => import("@/modules/admin/components/user-growth-chart").then((m) => m.UserGrowthChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

export const B2BvsB2CChart = dynamic(
  () => import("@/modules/admin/components/b2b-b2c-chart").then((m) => m.B2BvsB2CChart),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> }
);

export const OccupancyDonut = dynamic(
  () => import("@/modules/hotels/components/occupancy-donut").then((m) => m.OccupancyDonut),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <Skeleton className="mx-auto size-48 rounded-full" />
        <div className="h-4" />
      </div>
    ),
  }
);

export const SalesTimelineChart = dynamic(
  () => import("@/modules/agencies/components/sales-timeline-chart").then((m) => m.SalesTimelineChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    ),
  }
);

const SparklineChart = dynamic(() => import("./sparkline").then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <div className="h-8 w-[72px]" />,
});

/**
 * Same draw rule as Sparkline (two or more points, not flat), checked here so
 * a series that will draw nothing reserves no space while the chart loads.
 */
export function Sparkline({ data, positive }: { data: number[]; positive?: boolean }) {
  if (data.length < 2 || Math.min(...data) === Math.max(...data)) return null;
  return <SparklineChart data={data} positive={positive} />;
}
